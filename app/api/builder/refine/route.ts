import { NextResponse } from "next/server";
import { streamComplete } from "@/lib/ai";
import { getUserFromRequest } from "@/lib/serverAuth";
import { refineSchema } from "@/lib/schemas";
import { parseFiles, mergeFiles } from "@/lib/siteFiles";
import { ProjectStreamParser, friendlyFileLabel } from "@/lib/streamingProject";

export const maxDuration = 60;

function serializeFiles(files: { path: string; content: string }[]) {
  return files.map((f) => `===FILE: ${f.path}===\n${f.content}`).join("\n\n");
}

function sseFrame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Conversational editing: NOT a fresh generation, so it doesn't touch quota —
// only /api/builder and /api/farm charge against the daily free-tier limit.
// Streams the same way the main build does — the model is asked to return
// ONLY the files that actually change, so this is naturally a short stream.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Please sign in.", 401);

  const body = await request.json();
  const parsed = refineSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid request.", 400);
  const { originalBrief, siteName, currentFiles, changeRequest } = parsed.data;

  const system = `You are editing an existing website project. The user wants this specific change: ${changeRequest}. You have access to all current files. Be surgical — only modify files that need to change. Return ONLY the changed files in ===FILE: path=== format with ===END===. If only CSS changes, return only styles.css. Preserve all working functionality.`;

  const content = `Project: ${siteName}
Original brief: ${originalBrief}

Current files:
${serializeFiles(currentFiles)}

===END===`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseFrame(event, data)));

      try {
        send("status", { message: "Reading your current site…" });
        const parser = new ProjectStreamParser();
        const raw = await streamComplete({ system, content, maxTokens: 12000 }, (event) => {
          if (event.type !== "token") return;
          for (const evt of parser.feed(event.text)) {
            if (evt.type === "file-start") {
              send("file-start", { path: evt.path });
              send("status", { message: `${friendlyFileLabel(evt.path)}…` });
            } else if (evt.type === "file-delta") {
              send("file-delta", { path: evt.path, chunk: evt.chunk });
            } else if (evt.type === "file-done") {
              send("file-done", { path: evt.path, content: evt.content });
            }
          }
        });

        const changedFiles = parseFiles(raw);
        if (!changedFiles.length) throw new Error("no files returned");
        const files = mergeFiles(currentFiles, changedFiles);
        send("done", { files });
      } catch {
        send("error", { message: "Refine failed — try describing the change more specifically." });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
