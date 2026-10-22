"use client";

import { useState } from "react";

import { readSSEStream } from "@/lib/sse";
import type { Site } from "@/types";

export interface BuilderDonePayload {
  site: Site;
  sandboxPreviewUrl: string | null;
  sandboxErrors: string[];
  sandboxLogs: string[];
  remaining: number;
  analysis?: unknown;
}

export interface RefineDonePayload {
  files: { path: string; content: string }[];
}

export interface BuilderStreamCallbacks<TDone> {
  onStatus?: (message: string) => void;
  onFileStart?: (path: string) => void;
  onFileDelta?: (path: string, chunk: string) => void;
  onFileDone?: (path: string, content: string) => void;
  onDone?: (result: TDone) => void;
  onError?: (message: string) => void;
}

interface UseBuilderStreamOptions {
  url: string;
  accessToken: string;
}

// Structural twin of useSSEChat, but for the richer file-event vocabulary
// the builder generation/refine/screenshot routes stream: status, file-start,
// file-delta, file-done, done, error. The caller owns the actual file-list
// state (mirrors how useSSEChat leaves message-list state to its caller) —
// this hook is just the transport.
export function useBuilderStream<TDone = BuilderDonePayload>({ url, accessToken }: UseBuilderStreamOptions) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function generate(body: unknown, callbacks: BuilderStreamCallbacks<TDone> = {}) {
    setIsGenerating(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status}).`);
      }

      await readSSEStream(res, (eventName, dataStr) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(dataStr);
        } catch {
          return;
        }

        if (eventName === "status" && typeof data.message === "string") callbacks.onStatus?.(data.message);
        else if (eventName === "file-start" && typeof data.path === "string") callbacks.onFileStart?.(data.path);
        else if (eventName === "file-delta" && typeof data.path === "string" && typeof data.chunk === "string")
          callbacks.onFileDelta?.(data.path, data.chunk);
        else if (eventName === "file-done" && typeof data.path === "string" && typeof data.content === "string")
          callbacks.onFileDone?.(data.path, data.content);
        else if (eventName === "done") callbacks.onDone?.(data as unknown as TDone);
        else if (eventName === "error") throw new Error(typeof data.message === "string" ? data.message : "Generation failed.");
      });
    } catch (e) {
      callbacks.onError?.((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }

  return { generate, isGenerating };
}
