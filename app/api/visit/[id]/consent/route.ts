import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getOrCreateConsultation, setCallConsent, logClinicalAudit } from "@/lib/clinical";
import { authorizeVisit } from "@/lib/visit";

const schema = z.object({ consents: z.boolean() });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;
  const access = await authorizeVisit(db, user, params.id);
  if (!access) return NextResponse.json({ error: "Not part of this appointment." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { parties, role } = access;
  const consultation = await getOrCreateConsultation(db, parties.appointment.id, parties.doctor.id, parties.patient.id);
  if (!consultation) return NextResponse.json({ error: "Could not open the visit record." }, { status: 500 });
  const updated = await setCallConsent(db, consultation.id, role, parsed.data.consents);
  await logClinicalAudit(db, consultation.id, null, role, "visit_recording_consent", { consents: parsed.data.consents });
  return NextResponse.json({
    consent: { doctor: updated?.call_recording_consent_doctor ?? null, patient: updated?.call_recording_consent_patient ?? null },
  });
}
