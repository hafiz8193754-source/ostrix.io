// Single server-side AI client.
//
// xAI Grok (OpenAI-compatible chat completions at https://api.x.ai/v1) is the
// provider whenever XAI_API_KEY is set. Anthropic Claude is used only when
// that key is absent and ANTHROPIC_API_KEY is set. Callers keep passing the
// existing content blocks and server-tool descriptors; this module maps them
// onto chat-completions messages, image parts, file parts, and tools.

export type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
export type DocumentBlock = { type: "document"; source: { type: "base64"; media_type: string; data: string } };
export type TextBlock = { type: "text"; text: string };
export type AiContent = string | (ImageBlock | DocumentBlock | TextBlock)[];

export interface AiTool {
  type: string;
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface AiParams {
  system: string;
  content: AiContent;
  maxTokens?: number;
  tools?: AiTool[];
}

export type StreamEvent = { type: "token"; text: string } | { type: "tool_start" } | { type: "done" };

export type AiProvider = "xai" | "anthropic";

// Current flagship for code and chat on https://docs.x.ai/developers/models
// (checked October 2026). Override with XAI_MODEL.
export const DEFAULT_XAI_MODEL = "grok-4.7";
export const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

type ChatTextPart = { type: "text"; text: string };
type ChatImagePart = { type: "image_url"; image_url: { url: string; detail: "high" } };
type ChatFilePart = { type: "file"; file: { filename: string; file_data: string } };
type ChatPart = ChatTextPart | ChatImagePart | ChatFilePart;

type ChatMessage = { role: "system" | "user"; content: string | ChatPart[] };

type FunctionTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export interface XaiRequestExtras {
  tools?: FunctionTool[];
  search_parameters?: { mode: "auto"; return_citations: boolean };
}

interface ChatDelta {
  content?: string | Array<{ text?: string } | string> | null;
  tool_calls?: unknown[] | null;
}

interface ChatChunk {
  choices?: Array<{ delta?: ChatDelta }>;
}

export function extractJson<T = unknown>(text: string): T {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start !== -1 && end !== -1 ? clean.slice(start, end + 1) : clean) as T;
}

export function resolveProvider(): AiProvider {
  if (process.env.XAI_API_KEY?.trim()) return "xai";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  throw new Error(
    "Missing XAI_API_KEY. Set XAI_API_KEY to call Grok, or set ANTHROPIC_API_KEY to use Claude when XAI_API_KEY is unset."
  );
}

export function resolveModel(provider: AiProvider = resolveProvider()): string {
  if (provider === "xai") return process.env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL;
  return process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL;
}

function rawBase64(data: string): string {
  const comma = data.indexOf(",");
  if (data.startsWith("data:") && comma !== -1) return data.slice(comma + 1);
  return data;
}

function blockToPart(block: ImageBlock | DocumentBlock | TextBlock, index: number): ChatPart {
  if (block.type === "text") return { type: "text", text: block.text };
  if (block.type === "image") {
    const media = block.source.media_type || "image/jpeg";
    return {
      type: "image_url",
      image_url: { url: `data:${media};base64,${rawBase64(block.source.data)}`, detail: "high" },
    };
  }
  const media = block.source.media_type || "application/pdf";
  const ext = media.includes("pdf") ? "pdf" : "bin";
  return {
    type: "file",
    file: {
      filename: `attachment-${index}.${ext}`,
      file_data: `data:${media};base64,${rawBase64(block.source.data)}`,
    },
  };
}

// Anthropic keeps `system` beside `messages`. Chat completions put it in the
// message list. Image blocks become image_url data URLs; PDF document blocks
// become OpenAI file parts. Order of mixed text/image/file parts is preserved.
export function toChatMessages(system: string, content: AiContent): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (system) messages.push({ role: "system", content: system });
  if (typeof content === "string") {
    messages.push({ role: "user", content });
    return messages;
  }
  messages.push({ role: "user", content: content.map(blockToPart) });
  return messages;
}

function isWebSearchTool(tool: AiTool): boolean {
  const type = tool.type || "";
  const name = tool.name || "";
  return type === "web_search" || type === "web_search_preview" || type.startsWith("web_search_") || name === "web_search";
}

// Anthropic's web_search_* server tool runs inside one request and the text
// that comes back is already the final answer. xAI chat completions do the
// same through search_parameters (mode "auto" — the model decides, matching
// the previous tool). Other tools become OpenAI function definitions. This
// client does not run a follow-up tool loop: function-call payloads are
// surfaced as tool_start events and omitted from the returned text, which is
// what the previous client did with tool_use blocks.
export function mapTools(tools?: AiTool[]): XaiRequestExtras {
  if (!tools?.length) return {};
  const functions: FunctionTool[] = [];
  let webSearch = false;
  for (const tool of tools) {
    if (isWebSearchTool(tool)) {
      webSearch = true;
      continue;
    }
    const name = tool.name || tool.type || "tool";
    functions.push({
      type: "function",
      function: {
        name,
        description: tool.description || name,
        parameters: tool.input_schema || tool.parameters || { type: "object", properties: {} },
      },
    });
  }
  return {
    ...(functions.length ? { tools: functions } : {}),
    ...(webSearch ? { search_parameters: { mode: "auto", return_citations: true } } : {}),
  };
}

export function buildXaiRequest(params: AiParams, stream: boolean) {
  const extras = mapTools(params.tools);
  return {
    model: resolveModel("xai"),
    max_completion_tokens: params.maxTokens ?? 4096,
    messages: toChatMessages(params.system, params.content),
    stream,
    ...extras,
  };
}

function textFromContent(content: string | Array<{ text?: string } | string> | null | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
}

// Visible answer text only. reasoning_content is the model's scratchpad and
// must not leak into JSON parsers or the file-stream parser.
export function interpretChatChunk(parsed: ChatChunk): { text: string; toolStart: boolean } {
  const delta = parsed.choices?.[0]?.delta;
  const toolCalls = delta?.tool_calls;
  return {
    text: textFromContent(delta?.content),
    toolStart: Array.isArray(toolCalls) && toolCalls.length > 0,
  };
}

function messageText(data: { choices?: Array<{ message?: { content?: string | Array<{ text?: string } | string> | null } }> }): string {
  return textFromContent(data.choices?.[0]?.message?.content);
}

async function readSse(body: ReadableStream<Uint8Array>, onData: (payload: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const takeFrame = (frame: string) => {
    const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) return;
    const payload = dataLine.slice(5).trim();
    if (payload) onData(payload);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      takeFrame(frame);
    }
  }

  const tail = buffer.trim();
  if (tail) takeFrame(tail);
}

async function apiError(res: Response, label: string): Promise<Error> {
  const err = await res.text();
  return new Error(`${label} ${res.status}: ${err.slice(0, 300)}`);
}

function anthropicBody({ system, content, maxTokens = 4096, tools }: AiParams, stream: boolean) {
  return {
    model: resolveModel("anthropic"),
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content }],
    ...(stream ? { stream: true } : {}),
    ...(tools?.length ? { tools } : {}),
  };
}

async function completeAnthropic(params: AiParams): Promise<string> {
  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(anthropicBody(params, false)),
  });
  if (!res.ok) throw await apiError(res, "Claude API");
  const data: { content?: Array<{ type?: string; text?: string }> } = await res.json();
  return (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("\n");
}

async function streamAnthropic(params: AiParams, onEvent: (event: StreamEvent) => void): Promise<string> {
  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY?.trim() || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(anthropicBody(params, true)),
  });
  if (!res.ok || !res.body) throw await apiError(res, "Claude API");

  let full = "";
  await readSse(res.body, (payload) => {
    try {
      const parsed = JSON.parse(payload) as {
        type?: string;
        delta?: { type?: string; text?: string };
        content_block?: { type?: string };
      };
      if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
        const text = parsed.delta.text || "";
        full += text;
        onEvent({ type: "token", text });
      } else if (parsed.type === "content_block_start" && parsed.content_block?.type && parsed.content_block.type !== "text") {
        onEvent({ type: "tool_start" });
      }
    } catch {
      // ignore malformed frames — the next chunk completes them
    }
  });

  onEvent({ type: "done" });
  return full;
}

async function completeXai(params: AiParams): Promise<string> {
  const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.XAI_API_KEY?.trim() || ""}`,
    },
    body: JSON.stringify(buildXaiRequest(params, false)),
  });
  if (!res.ok) throw await apiError(res, "xAI API");
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string } | string> | null } }>;
  };
  return messageText(data);
}

async function streamXai(params: AiParams, onEvent: (event: StreamEvent) => void): Promise<string> {
  const body = buildXaiRequest(params, true);
  const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.XAI_API_KEY?.trim() || ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw await apiError(res, "xAI API");

  // Server-side web search happens before visible tokens. Emit tool_start as
  // soon as the stream is open so callers can show "Searching…" during that
  // wait, the same moment Anthropic used to open a non-text content block.
  if (body.search_parameters) onEvent({ type: "tool_start" });

  let full = "";
  await readSse(res.body, (payload) => {
    if (payload === "[DONE]") return;
    try {
      const { text, toolStart } = interpretChatChunk(JSON.parse(payload) as ChatChunk);
      if (toolStart) onEvent({ type: "tool_start" });
      if (text) {
        full += text;
        onEvent({ type: "token", text });
      }
    } catch {
      // ignore malformed frames
    }
  });

  onEvent({ type: "done" });
  return full;
}

export async function complete(params: AiParams): Promise<string> {
  return resolveProvider() === "xai" ? completeXai(params) : completeAnthropic(params);
}

export async function streamComplete(params: AiParams, onEvent: (event: StreamEvent) => void): Promise<string> {
  return resolveProvider() === "xai" ? streamXai(params, onEvent) : streamAnthropic(params, onEvent);
}
