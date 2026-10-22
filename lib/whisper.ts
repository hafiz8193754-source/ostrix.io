// Server-only transcription.
// xAI Grok speech-to-text when XAI_API_KEY is set. OpenAI Whisper is the
// fallback when that key is absent. WHISPER_API_KEY stays server-only.

const XAI_STT_URL = "https://api.x.ai/v1/stt";
const XAI_STT_MODEL = "grok-voice-transcribe-2.0";
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

export async function transcribeAudio(audio: Blob, filename = "recording.webm"): Promise<string> {
  if (process.env.XAI_API_KEY?.trim()) return transcribeWithXai(audio, filename);
  return transcribeWithWhisper(audio, filename);
}

async function transcribeWithXai(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  // Model must precede the file. Later fields can be ignored on streamed uploads.
  form.append("model", XAI_STT_MODEL);
  form.append("file", audio, filename);

  const res = await fetch(XAI_STT_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.XAI_API_KEY?.trim() || ""}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI STT ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.text as string) || "";
}

async function transcribeWithWhisper(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");

  const res = await fetch(WHISPER_URL, {
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
