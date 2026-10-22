import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { transcribeAudio } from "@/lib/whisper";

export const maxDuration = 90;

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

// Generic Whisper transcription endpoint — shared by every agent's voice
// input (Doctor's intake, Farm's intake), not agent-specific. Nothing in
// this handler depends on which agent is calling it.
export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "No audio provided." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Recording too long." }, { status: 400 });

  try {
    const text = await transcribeAudio(audio, "recording.webm");
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not transcribe audio." }, { status: 502 });
  }
}
