import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/serverAuth";
import { requireVerifiedDoctor } from "@/lib/doctorGuard";
import { callConsentSchema } from "@/lib/schemas";
import { getAppointmentWithParties, getConsultation, setCallConsent, startCallRecording, logClinicalAudit } from "@/lib/clinical";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = callConsentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { consultation_id, party, consents } = parsed.data;

  let db: SupabaseClient;
  if (party === "doctor") {
    const guard = await requireVerifiedDoctor(request);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    db = guard.db;
    const existing = await getConsultation(db, consultation_id);
    if (!existing) return NextResponse.json({ error: "Consultation not found." }, { status: 404 });
    if (existing.doctor_id !== guard.doctor.id)
      return NextResponse.json({ error: "You are not the doctor for this consultation." }, { status: 403 });
  } else {
    const auth = await getUserFromRequest(request);
    if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    db = auth.db;
    const existing = await getConsultation(db, consultation_id);
    if (!existing) return NextResponse.json({ error: "Consultation not found." }, { status: 404 });
    const parties = await getAppointmentWithParties(db, existing.appointment_id);
    if (!parties || parties.patient.user_id !== auth.user.id)
      return NextResponse.json({ error: "You are not the patient for this consultation." }, { status: 403 });
  }

  const consultation = await setCallConsent(db, consultation_id, party, consents);
  if (!consultation) return NextResponse.json({ error: "Could not update consent." }, { status: 500 });

  await logClinicalAudit(db, consultation_id, null, party, "call_consent", { consents });

  // Recording only ever starts once BOTH parties have explicitly consented.
  const bothConsented = consultation.call_recording_consent_patient && consultation.call_recording_consent_doctor;
  if (bothConsented && !consultation.call_started_at) {
    await startCallRecording(db, consultation_id);
    await logClinicalAudit(db, consultation_id, null, "system", "recording_started", {});
  }

  return NextResponse.json({ consultation, recording_active: bothConsented });
}
