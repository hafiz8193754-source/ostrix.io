import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import {
  getOrCreateConsultation,
  markCallEnded,
  saveCallRecording,
  savePrescriptionDraft,
  logClinicalAudit,
} from "@/lib/clinical";
import { generatePrescriptionDraft } from "@/lib/clinicalAI";
import { transcribeAudio } from "@/lib/whisper";
import { createNotification } from "@/lib/notifications";
import { AUDIO_BUCKET, MAX_VISIT_AUDIO_BYTES, authorizeVisit, intakeSummaryFrom } from "@/lib/visit";

export const maxDuration = 120;

// End-of-visit upload from the doctor's browser: the locally recorded (mixed)
// audio goes to the private bucket, Grok STT transcribes it, then the existing
// prescription-draft pipeline runs exactly like the Twilio recording callback.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;
  const access = await authorizeVisit(db, user, params.id);
  if (!access) return NextResponse.json({ error: "Not part of this appointment." }, { status: 403 });
  const { parties, role } = access;

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const duration = Math.max(0, Math.round(Number(form?.get("duration_seconds") || 0)));
  const doctorNotes = String(form?.get("doctor_notes") || "").slice(0, 4000);
  const consultation = await getOrCreateConsultation(db, parties.appointment.id, parties.doctor.id, parties.patient.id);
  if (!consultation) return NextResponse.json({ error: "Could not open the visit record." }, { status: 500 });

  await markCallEnded(db, consultation.id, duration || null);
  await db.from("consultations").update({ visit_mode: "webrtc" }).eq("id", consultation.id);

  if (!(audio instanceof Blob) || audio.size === 0) {
    await logClinicalAudit(db, consultation.id, null, role, "visit_ended_without_recording", { duration });
    return NextResponse.json({ ok: true, recorded: false });
  }
  if (role !== "doctor") return NextResponse.json({ error: "Only the doctor's side uploads the visit recording." }, { status: 403 });
  if (!consultation.call_recording_consent_patient || !consultation.call_recording_consent_doctor)
    return NextResponse.json({ error: "Both doctor and patient must consent before a recording is saved." }, { status: 403 });
  if (audio.size > MAX_VISIT_AUDIO_BYTES) return NextResponse.json({ error: "Recording too large." }, { status: 413 });

  const path = `visits/${parties.appointment.id}/${consultation.id}-${Date.now()}.webm`;
  const { error: upErr } = await db.storage.from(AUDIO_BUCKET).upload(path, audio, { contentType: audio.type || "audio/webm", upsert: false });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  let transcript = "";
  try {
    transcript = await transcribeAudio(audio, "visit.webm");
  } catch (e) {
    await saveCallRecording(db, consultation.id, `storage:${AUDIO_BUCKET}/${path}`, "");
    await logClinicalAudit(db, consultation.id, null, "system", "visit_transcription_failed", { error: (e as Error).message });
    return NextResponse.json({ ok: true, recorded: true, transcript: null, error: "Saved the recording, but transcription failed." });
  }
  await saveCallRecording(db, consultation.id, `storage:${AUDIO_BUCKET}/${path}`, transcript);
  if (doctorNotes) await db.from("consultations").update({ doctor_notes: doctorNotes }).eq("id", consultation.id);
  await logClinicalAudit(db, consultation.id, null, "system", "visit_transcribed", { length: transcript.length });

  try {
    const draft = await generatePrescriptionDraft({
      intakeSummary: intakeSummaryFrom(parties.appointment.ai_symptom_analysis, parties.appointment.symptoms_description),
      callTranscript: transcript,
      visitSummary: consultation.ai_visit_summary,
      doctorNotes: doctorNotes || consultation.doctor_notes,
      knownAllergies: parties.patient.known_allergies || [],
      currentMedications: parties.patient.current_medications || [],
      patientAge: parties.patient.age,
      patientGender: parties.patient.gender,
    });
    const prescription = await savePrescriptionDraft(
      db,
      consultation.id,
      parties.doctor.id,
      parties.patient.id,
      parties.doctor.pmdc_number,
      draft,
      [...(draft.drug_interaction_warnings || []), ...(draft.contraindication_flags || [])],
      draft.drug_interaction_warnings || []
    );
    await logClinicalAudit(db, consultation.id, prescription?.id || null, "ai", "prescription_drafted_from_visit", {});
    if (prescription && parties.doctor.user_id) {
      await createNotification(
        db,
        parties.doctor.user_id,
        "prescription_draft_ready",
        "A prescription draft is ready to review",
        `Draft for ${parties.patient.full_name} is ready — review and sign it on your dashboard.`,
        "/doctor/dashboard"
      ).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, recorded: true, transcript, prescription_id: prescription?.id ?? null });
  } catch (e) {
    await logClinicalAudit(db, consultation.id, null, "system", "visit_draft_failed", { error: (e as Error).message });
    return NextResponse.json({ ok: true, recorded: true, transcript, prescription_id: null, error: "Transcript saved, but the draft failed." });
  }
}
