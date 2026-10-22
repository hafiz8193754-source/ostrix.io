import { NextResponse } from "next/server";
import { complete, streamComplete, extractJson } from "@/lib/ai";
import { getUserFromRequest, checkQuota, recordGeneration } from "@/lib/serverAuth";
import { screenshotBuildSchema } from "@/lib/schemas";
import { parseProject } from "@/lib/siteFiles";
import { runSandboxPass } from "@/lib/sandbox";
import { ProjectStreamParser, friendlyFileLabel } from "@/lib/streamingProject";
import type { ScreenshotAnalysis } from "@/types";

export const maxDuration = 120;

const ANALYSIS_SYSTEM = `You are an expert UI/UX analyst. Analyze this website screenshot in detail and return a JSON object describing it. Return ONLY valid JSON, no markdown:
{
  "business_type": "what kind of business/site this is",
  "layout": "description of the overall layout structure",
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "typography": "description of font styles and hierarchy",
  "sections": ["list", "of", "identified", "sections"],
  "navigation_style": "description of nav",
  "hero_style": "description of hero section",
  "interactions": ["identified", "interactive", "elements"],
  "overall_aesthetic": "one paragraph describing the design language",
  "improvements_needed": ["list", "of", "things", "to", "improve"]
}`;

const REBUILD_SYSTEM = `You are an elite web developer rebuilding a website from a design analysis. Your job is to recreate the layout and aesthetic described, but improve upon it — fix what is weak, enhance what is strong, make it more professional and modern.

Output format — no markdown fences, no commentary:
===META name='slug' summary='one sentence'===
===FILE: index.html===
(complete file)
===FILE: styles.css===
(complete file)
===FILE: script.js===
(complete file)
===END===

Requirements:
- Faithfully recreate the layout structure and color palette from the analysis
- Improve typography, spacing, and visual hierarchy
- Add smooth animations the original may lack
- Make it fully responsive (the screenshot may only show desktop)
- Generate real, professional content matching the business type
- All JS interactions must work: nav, scroll, animations
- Every image uses a real Unsplash source URL matched to its section's content (e.g. https://source.unsplash.com/1600x900/?restaurant,interior) with a descriptive alt attribute — never a gray box, CSS gradient standing in for a photo, or broken src
- SEO meta tags, Open Graph tags, an inline SVG data-URI favicon, and WCAG AA contrast, same as any production site`;

function sseFrame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Please sign in.", 401);

  const limit = parseInt(process.env.FREE_DAILY_BUILDS || "3", 10);
  const quota = await checkQuota(user.id, "builder", limit);
  if (!quota.allowed) return jsonError(`Daily free limit reached (${limit} builds). Try again tomorrow.`, 429);

  const body = await request.json();
  const parsed = screenshotBuildSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid request.", 400);
  const { screenshot, additionalBrief } = parsed.data;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseFrame(event, data)));

      try {
        // Step 1: analyze the screenshot (fast, single call — not worth streaming).
        send("status", { message: "Analyzing your screenshot…" });
        const analysisRaw = await complete({
          system: ANALYSIS_SYSTEM,
          content: [
            { type: "image", source: { type: "base64", media_type: screenshot.type, data: screenshot.data } },
            {
              type: "text",
              text: `Analyze this website screenshot in detail.${additionalBrief ? ` Additional context from user: ${additionalBrief}` : ""}`,
            },
          ],
          maxTokens: 1000,
        });
        const analysis = extractJson<ScreenshotAnalysis>(analysisRaw);

        // Step 2: rebuild from the analysis — this is the part worth streaming live.
        const rebuildPrompt = `DESIGN ANALYSIS OF THE SCREENSHOT:
Business type: ${analysis.business_type}
Layout: ${analysis.layout}
Color palette: ${(analysis.color_palette || []).join(", ")}
Typography: ${analysis.typography}
Sections identified: ${(analysis.sections || []).join(", ")}
Navigation: ${analysis.navigation_style}
Hero: ${analysis.hero_style}
Overall aesthetic: ${analysis.overall_aesthetic}
Things to improve: ${(analysis.improvements_needed || []).join(", ")}
${additionalBrief ? `\nUser's additional instructions: ${additionalBrief}` : ""}

Rebuild this website faithfully but improved. Generate all files now.`;

        send("status", { message: "Planning structure…" });
        const parser = new ProjectStreamParser();
        const raw = await streamComplete(
          {
            system: REBUILD_SYSTEM,
            content: [
              { type: "image", source: { type: "base64", media_type: screenshot.type, data: screenshot.data } },
              { type: "text", text: rebuildPrompt },
            ],
            maxTokens: 32000,
          },
          (event) => {
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
          }
        );

        const site = parseProject(raw, analysis.business_type || "website");
        site.summary = `Rebuilt from screenshot: ${site.summary}`;

        send("status", { message: "Testing in the sandbox…" });
        const sandbox = await runSandboxPass(site.files);
        site.files = sandbox.files;

        await recordGeneration(user.id, "builder", { name: site.name, source: "screenshot" });

        send("done", {
          site,
          analysis,
          sandboxPreviewUrl: sandbox.sandboxPreviewUrl,
          sandboxErrors: sandbox.sandboxErrors,
          sandboxLogs: sandbox.sandboxLogs,
          remaining: Math.max(0, quota.limit - quota.used - 1),
        });
      } catch {
        send("error", { message: "Screenshot rebuild failed. Please try again." });
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
