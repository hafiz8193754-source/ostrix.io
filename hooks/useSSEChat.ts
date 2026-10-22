"use client";

import { useState } from "react";

import { readSSEStream } from "@/lib/sse";

export interface SSEChatCallbacks {
  onStatus?: (message: string) => void;
  onToken?: (text: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (message: string) => void;
}

interface UseSSEChatOptions {
  url: string;
  accessToken: string;
}

// Hand-rolled SSE reader over fetch — browsers' native EventSource can't send
// a POST body or an Authorization header, so this is the standard workaround
// for authenticated, POST-based streaming. Reusable by any future streaming
// agent, not just Prompt Engineer.
export function useSSEChat({ url, accessToken }: UseSSEChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");

  async function send(body: unknown, callbacks: SSEChatCallbacks = {}) {
    setIsStreaming(true);
    setStatus(null);
    setStreamingText("");
    let acc = "";

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
        let data: { message?: string; text?: string };
        try {
          data = JSON.parse(dataStr);
        } catch {
          return;
        }

        if (eventName === "status" && data.message) {
          setStatus(data.message);
          callbacks.onStatus?.(data.message);
        } else if (eventName === "token" && data.text) {
          acc += data.text;
          setStreamingText(acc);
          callbacks.onToken?.(data.text);
        } else if (eventName === "done") {
          callbacks.onDone?.(data.text ?? acc);
        } else if (eventName === "error") {
          throw new Error(data.message || "Stream error.");
        }
      });
    } catch (e) {
      callbacks.onError?.((e as Error).message);
    } finally {
      setIsStreaming(false);
      setStatus(null);
    }
  }

  return { send, isStreaming, status, streamingText };
}
