// Server-only helper for OpenAI's Whisper transcription endpoint.
// WHISPER_API_KEY stays on the server, named exactly as specced.
export async function transcribeAudio(audio: Blob, filename = "recording.webm"): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHISPER_API_KEY || ""}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.text as string) || "";
}
