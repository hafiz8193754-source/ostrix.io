// Hand-rolled SSE frame reader over a fetch Response — browsers' native
// EventSource can't send a POST body or an Authorization header, so reading
// the raw stream ourselves is the standard workaround for authenticated,
// POST-based streaming. Shared by every SSE-consuming hook (Prompt Engineer's
// simple text stream, Builder's richer file-event stream) so the fiddly
// frame-boundary parsing exists in exactly one place.
export async function readSSEStream(response: Response, onFrame: (event: string, data: string) => void): Promise<void> {
  if (!response.body) throw new Error("Response has no body to stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are blank-line-delimited; each frame is "event:"/"data:" lines.
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const eventLine = frame.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      const eventName = eventLine ? eventLine.slice(6).trim() : "message";
      const dataStr = dataLine ? dataLine.slice(5).trim() : "";
      if (!dataStr) continue;

      onFrame(eventName, dataStr);
    }
  }
}
