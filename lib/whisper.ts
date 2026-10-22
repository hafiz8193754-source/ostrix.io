// Server-only transcription.
// Try xAI Grok speech-to-text when XAI_API_KEY is set. If that key is missing
// or the xAI call throws, fall back to OpenAI Whisper when a Whisper key exists.

const XAI_STT_URL = "https://api.x.ai/v1/stt";
const DEFAULT_XAI_STT_MODEL = "grok-voice-transcribe-2.0";
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const NOT_CONFIGURED = "Transcription isn't configured: set XAI_API_KEY or WHISPER_API_KEY/OPENAI_API_KEY";

function envKey(name: string): string {
  return process.env[name]?.trim() || "";
}

export async function transcribeAudio(audio: Blob, filename = "recording.webm"): Promise<string> {
  const xaiKey = envKey("XAI_API_KEY");
  const whisperKey = envKey("WHISPER_API_KEY") || envKey("OPENAI_API_KEY");

  if (!xaiKey && !whisperKey) throw new Error(NOT_CONFIGURED);

  if (xaiKey) {
    try {
      return await transcribeWithXai(audio, filename, xaiKey);
    } catch (err) {
      if (!whisperKey) throw err;
    }
  }

  return transcribeWithWhisper(audio, filename, whisperKey);
}

async function transcribeWithXai(audio: Blob, filename: string, apiKey: string): Promise<string> {
  const form = new FormData();
  // Model must precede the file. Later fields can be ignored on streamed uploads.
  form.append("model", process.env.XAI_STT_MODEL?.trim() || DEFAULT_XAI_STT_MODEL);
  form.append("file", audio, filename);

  const res = await fetch(XAI_STT_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI STT ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.text as string) || "";
}

async function transcribeWithWhisper(audio: Blob, filename: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");

  const res = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.text as string) || "";
}
