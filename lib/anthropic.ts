export type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
export type DocumentBlock = { type: "document"; source: { type: "base64"; media_type: string; data: string } };
export type TextBlock = { type: "text"; text: string };
export type ClaudeContent = string | (ImageBlock | DocumentBlock | TextBlock)[];

export interface ClaudeTool {
  type: string;
  name: string;
}

interface ClaudeParams {
  system: string;
  content: ClaudeContent;
  maxTokens?: number;
  tools?: ClaudeTool[];
}

interface ClaudeResponseBlock {
  type: string;
  text?: string;
}

interface ClaudeResponse {
  content?: ClaudeResponseBlock[];
}

// Server-only helper for the Claude API. ANTHROPIC_API_KEY stays on the server.
// `tools` (e.g. Anthropic's native web_search_20250305 server tool) runs
// entirely within this one call — the model decides to search, Anthropic
// executes it server-side, and the response already has the final text.
// tool_use/tool_result blocks are silently skipped below (only type "text"
// is kept), so passing tools needs no other change to this function.
export async function claude({ system, content, maxTokens = 4096, tools }: ClaudeParams): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      ...(tools?.length ? { tools } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data: ClaudeResponse = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("\n");
}

type StreamEvent = { type: "token"; text: string } | { type: "tool_start" } | { type: "done" };

// Streaming counterpart to claude() — used by Prompt Engineer, Builder, and
// (this round) Farm. Parses Anthropic's own SSE frames directly off the
// fetch response body and calls onEvent per text delta, resolving with the
// full accumulated text once the stream ends so the caller can persist it.
// When `tools` is passed, a `tool_start` event fires the moment the model
// opens any non-text content block (i.e. it's invoking a tool, most likely
// web_search) — callers use this to show a real "Searching…" status line.
export async function streamClaude(
  { system, content, maxTokens = 4096, tools }: ClaudeParams,
  onEvent: (event: StreamEvent) => void
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      stream: true,
      ...(tools?.length ? { tools } : {}),
    }),
  });
  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const jsonStr = dataLine.slice(5).trim();
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          const text: string = parsed.delta.text;
          full += text;
          onEvent({ type: "token", text });
        } else if (parsed.type === "content_block_start" && parsed.content_block?.type && parsed.content_block.type !== "text") {
          // Any non-text content block is the model invoking a tool (most
          // likely web_search) — surfaced generically rather than matching
          // an exact block-type string this environment can't verify live.
          onEvent({ type: "tool_start" });
        }
      } catch {
        // ignore malformed/partial frames — the next chunk completes them
      }
    }
  }

  onEvent({ type: "done" });
  return full;
}

export function extractJson<T = unknown>(text: string): T {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start !== -1 && end !== -1 ? clean.slice(start, end + 1) : clean) as T;
}
