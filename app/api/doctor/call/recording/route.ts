import { NextResponse } from "next/server";
import { verifyTwilioRequest } from "@/lib/twilio";
import { saveCallRecording, getConsultation, getAppointmentWithParties, savePrescriptionDraft, logClinicalAudit } from "@/lib/clinical";
import { generatePrescriptionDraft } from "@/lib/clinicalAI";
import { transcribeAudio } from "@/lib/whisper";
import { createNotification } from "@/lib/notifications";

export const maxDuration = 60;

function summarizeIntake(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const intake = (raw as { intake?: Record<string, unknown> }).intake;
  if (!intake) return null;
  return Object.entries(intake)
    .filter(([, v]) => v !== null && v !== "" && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}

// Twilio's recording-status callback for the conference — fires once the
// recording is ready. Fetches the audio, transcribes it, saves the
// transcript, then runs the draft pipeline automatically (mirrors the
// existing call/end → visit-summary auto-trigger pattern).
export async function POST(request: Request) {
  const { valid, params } = await verifyTwilioRequest(request);
  if (!valid) return NextResponse.json({ error: "Invalid signature." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const consultationId = searchParams.get("consultation");
  if (!consultationId) return NextResponse.json({ ok: true });
  if (params.RecordingStatus !== "completed" || !params.RecordingUrl) return NextResponse.json({ ok: true });

  try {
    const recordingUrl = `${params.RecordingUrl}.mp3`;
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const audioRes = await fetch(recordingUrl, { headers: { authorization: `Basic ${auth}` } });
    if (!audioRes.ok) throw new Error(`Could not fetch the recording (${audioRes.status}).`);
    const audioBlob = await audioRes.blob();

    const transcript = await transcribeAudio(audioBlob, "consultation.mp3");
    await saveCallRecording(consultationId, recordingUrl, transcript);
    await logClinicalAudit(consultationId, null, "system", "call_transcribed", { length: transcript.length });

    const consultation = await getConsultation(consultationId);
    if (!consultation) return NextResponse.json({ ok: true });
    const parties = await getAppointmentWithParties(consultation.appointment_id);
    if (!parties) return NextResponse.json({ ok: true });

    const draft = await generatePrescriptionDraft({
      intakeSummary: summarizeIntake(parties.appointment.ai_symptom_analysis),
      callTranscript: transcript,
      visitSummary: consultation.ai_visit_summary,
      doctorNotes: consultation.doctor_notes,
      knownAllergies: parties.patient.known_allergies,
      currentMedications: parties.patient.current_medications,
      patientAge: parties.patient.age,
      patientGender: parties.patient.gender,
    });

    const prescription = await savePrescriptionDraft(
      consultation.id,
      parties.doctor.id,
      parties.patient.id,
      parties.doctor.pmdc_number,
      draft,
      [...draft.drug_interaction_warnings, ...draft.contraindication_flags],
      draft.drug_interaction_warnings
    );

    if (prescription && parties.doctor.user_id) {
      await createNotification(
        parties.doctor.user_id,
        "prescription_draft_ready",
        "A prescription draft is ready to review",
        `Draft for ${parties.patient.full_name} is ready — review and sign it on your dashboard.`,
        "/doctor/dashboard"
      );
    }
    await logClinicalAudit(consultation.id, prescription?.id || null, "ai", "prescription_drafted_from_call", {});
  } catch (e) {
    await logClinicalAudit(consultationId, null, "system", "call_transcription_failed", { error: (e as Error).message });
  }

  return NextResponse.json({ ok: true });
}
