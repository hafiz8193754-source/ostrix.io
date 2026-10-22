import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_XAI_FAST_MODEL,
  DEFAULT_XAI_MODEL,
  buildXaiRequest,
  extractJson,
  interpretChatChunk,
  mapTools,
  resolveModel,
  resolveProvider,
  toChatMessages,
  type AiTool,
} from "./ai";

const ENV_KEYS = ["XAI_API_KEY", "XAI_MODEL", "XAI_FAST_MODEL", "ANTHROPIC_API_KEY", "CLAUDE_MODEL"] as const;
const previous: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    if (!(key in previous)) previous[key] = process.env[key];
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resolveProvider", () => {
  it("uses xAI whenever XAI_API_KEY is set, even if an Anthropic key is also present", () => {
    setEnv({ XAI_API_KEY: "xai-key", ANTHROPIC_API_KEY: "sk-ant-key" });
    expect(resolveProvider()).toBe("xai");
  });

  it("falls back to Anthropic only when XAI_API_KEY is unset", () => {
    setEnv({ XAI_API_KEY: undefined, ANTHROPIC_API_KEY: "sk-ant-key" });
    expect(resolveProvider()).toBe("anthropic");
  });

  it("refuses to call either provider when no key is configured", () => {
    setEnv({ XAI_API_KEY: "  ", ANTHROPIC_API_KEY: undefined });
    expect(() => resolveProvider()).toThrow(/XAI_API_KEY/);
  });
});

describe("resolveModel", () => {
  it("defaults to the current Grok flagship and honors XAI_MODEL", () => {
    setEnv({ XAI_MODEL: undefined });
    expect(resolveModel("xai")).toBe(DEFAULT_XAI_MODEL);
    expect(DEFAULT_XAI_MODEL).toBe("grok-4.7");
    setEnv({ XAI_MODEL: "grok-4" });
    expect(resolveModel("xai")).toBe("grok-4");
  });

  it("uses the non-reasoning model for intake turns and leaves final analysis on XAI_MODEL", () => {
    setEnv({ XAI_MODEL: "grok-4.7", XAI_FAST_MODEL: undefined });
    expect(resolveModel("xai", { fast: true })).toBe(DEFAULT_XAI_FAST_MODEL);
    expect(DEFAULT_XAI_FAST_MODEL).toBe("grok-4.20-0309-non-reasoning");
    expect(resolveModel("xai")).toBe("grok-4.7");

    setEnv({ XAI_FAST_MODEL: "  " });
    expect(resolveModel("xai", { fast: true })).toBe(DEFAULT_XAI_FAST_MODEL);

    setEnv({ XAI_MODEL: "grok-4.7", XAI_FAST_MODEL: "grok-fast-custom" });
    expect(buildXaiRequest({ system: "s", content: "intake", maxTokens: 200, fast: true }, false).model).toBe("grok-fast-custom");
    expect(buildXaiRequest({ system: "s", content: "final", maxTokens: 200 }, false).model).toBe("grok-4.7");
  });
});

describe("chat completions mapping", () => {
  it("places the system prompt in a system message and leaves plain text as a user string", () => {
    expect(toChatMessages("Be brief.", "Hello")).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hello" },
    ]);
  });

  it("maps image blocks to high-detail image_url data URLs and PDFs to file parts", () => {
    const messages = toChatMessages("Look.", [
      { type: "image", source: { type: "base64", media_type: "image/png", data: "aW1n" } },
      { type: "text", text: "What is this?" },
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: "data:application/pdf;base64,cGRm" } },
    ]);
    expect(messages[1]).toEqual({
      role: "user",
      content: [
        { type: "image_url", image_url: { url: "data:image/png;base64,aW1n", detail: "high" } },
        { type: "text", text: "What is this?" },
        { type: "file", file: { filename: "attachment-2.pdf", file_data: "data:application/pdf;base64,cGRm" } },
      ],
    });
  });

  it("drops deprecated web search and maps other tools to functions", () => {
    const webSearch: AiTool = { type: "web_search_20250305", name: "web_search" };
    expect(mapTools([webSearch])).toEqual({});

    const custom: AiTool = {
      type: "custom",
      name: "lookup_dose",
      description: "Look up a dose",
      input_schema: { type: "object", properties: { drug: { type: "string" } }, required: ["drug"] },
    };
    expect(mapTools([custom, webSearch])).toEqual({
      tools: [
        {
          type: "function",
          function: {
            name: "lookup_dose",
            description: "Look up a dose",
            parameters: custom.input_schema,
          },
        },
      ],
    });
  });

  it("builds a streaming chat-completions body with max_completion_tokens", () => {
    setEnv({ XAI_MODEL: undefined });
    const body = buildXaiRequest(
      { system: "JSON only", content: "symptoms", maxTokens: 1200, tools: [{ type: "web_search_20250305", name: "web_search" }] },
      true
    );
    expect(body).toMatchObject({
      model: "grok-4.7",
      max_completion_tokens: 1200,
      stream: true,
      messages: [
        { role: "system", content: "JSON only" },
        { role: "user", content: "symptoms" },
      ],
    });
    expect(body).not.toHaveProperty("search_parameters");
    expect(body).not.toHaveProperty("tools");
  });
});

describe("interpretChatChunk", () => {
  it("keeps visible text and ignores reasoning, and flags function-call deltas", () => {
    expect(
      interpretChatChunk({
        choices: [{ delta: { content: "Hello", reasoning_content: "plan" } as { content: string } }],
      }).text
    ).toBe("Hello");
    expect(interpretChatChunk({ choices: [{ delta: { content: null, tool_calls: [{ index: 0 }] } }] })).toEqual({
      text: "",
      toolStart: true,
    });
  });
});

describe("extractJson", () => {
  it("parses a fenced JSON object", () => {
    expect(extractJson<{ ok: boolean }>("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });
});
