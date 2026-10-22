import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logClinicalAudit } from "@/lib/clinical";
import { transcribeAudio } from "@/lib/whisper";
import { createNotification } from "@/lib/notifications";
import { AUDIO_BUCKET, authorizeVisit } from "@/lib/visit";

export const maxDuration = 90;
const MAX_NOTE_BYTES = 8 * 1024 * 1024;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;
  const access = await authorizeVisit(db, user, params.id);
  if (!access) return NextResponse.json({ error: "Not part of this appointment." }, { status: 403 });
  const { data, error } = await db
    .from("voice_notes")
    .select("id, sender_role, duration_seconds, transcript, transcript_error, created_at, storage_path")
    .eq("appointment_id", params.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: "Could not load voice notes." }, { status: 500 });
  const notes = await Promise.all(
    (data || []).map(async ({ storage_path, ...n }) => {
      const { data: signed } = await db.storage.from(AUDIO_BUCKET).createSignedUrl(storage_path, 60 * 30);
      return { ...n, audio_url: signed?.signedUrl ?? null, mine: n.sender_role === access.role };
    })
  );
  return NextResponse.json({ notes, role: access.role });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;
  const access = await authorizeVisit(db, user, params.id);
  if (!access) return NextResponse.json({ error: "Not part of this appointment." }, { status: 403 });
  const { parties, role } = access;
  if (parties.appointment.status === "cancelled") return NextResponse.json({ error: "This appointment was cancelled." }, { status: 409 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "No audio provided." }, { status: 400 });
  if (audio.size > MAX_NOTE_BYTES) return NextResponse.json({ error: "Voice note too long." }, { status: 413 });
  const duration = Math.max(0, Math.round(Number(form?.get("duration_seconds") || 0)));

  const path = `notes/${params.id}/${Date.now()}-${role}.webm`;
  const { error: upErr } = await db.storage.from(AUDIO_BUCKET).upload(path, audio, { contentType: audio.type || "audio/webm" });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  let transcript: string | null = null;
  let transcriptError: string | null = null;
  try {
    transcript = await transcribeAudio(audio, "voice-note.webm");
  } catch (e) {
    transcriptError = (e as Error).message.slice(0, 300);
  }
  const { data: note, error } = await db
    .from("voice_notes")
    .insert({ appointment_id: params.id, sender_role: role, sender_user_id: user.id, storage_path: path, duration_seconds: duration, transcript, transcript_error: transcriptError })
    .select("id, sender_role, duration_seconds, transcript, transcript_error, created_at")
    .single();
  if (error) return NextResponse.json({ error: "Could not save the voice note." }, { status: 500 });
  await logClinicalAudit(db, null, null, role, "voice_note_sent", { appointment_id: params.id, note_id: note.id });

  const otherUserId = role === "doctor" ? parties.patient.user_id : parties.doctor.user_id;
  if (otherUserId && otherUserId !== user.id) {
    await createNotification(
      db,
      otherUserId,
      "voice_note",
      "New voice message",
      `You have a new voice message about your ${parties.appointment.appointment_date} appointment.`,
      `/visit/${params.id}#notes`
    ).catch(() => undefined);
  }
  return NextResponse.json({ note: { ...note, mine: true, audio_url: null } });
}
