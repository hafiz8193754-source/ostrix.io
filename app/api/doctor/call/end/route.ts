import { NextResponse } from "next/server";
import { requireVerifiedDoctor } from "@/lib/doctorGuard";
import { callEndSchema } from "@/lib/schemas";
import { getConsultation, endCall, logClinicalAudit } from "@/lib/clinical";
import { generateVisitSummary } from "@/lib/clinicalAI";

export const maxDuration = 90;

export async function POST(request: Request) {
  const guard = await requireVerifiedDoctor(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await request.json();
  const parsed = callEndSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { consultation_id, duration_seconds, doctor_notes } = parsed.data;

  const existing = await getConsultation(guard.db, consultation_id);
  if (!existing) return NextResponse.json({ error: "Consultation not found." }, { status: 404 });
  if (existing.doctor_id !== guard.doctor.id)
    return NextResponse.json({ error: "You are not the doctor for this consultation." }, { status: 403 });

  const consultation = await endCall(guard.db, consultation_id, duration_seconds, doctor_notes || "");
  if (!consultation) return NextResponse.json({ error: "Could not end the call." }, { status: 500 });
  await logClinicalAudit(guard.db, consultation_id, null, "doctor", "call_ended", { duration_seconds });

  let summary: unknown = null;
  if ((doctor_notes || "").trim()) {
    try {
      summary = await generateVisitSummary(guard.db, consultation_id, doctor_notes || "");
    } catch {
      // Summary is a convenience — the doctor's raw notes are already saved either way.
    }
  }

  return NextResponse.json({ consultation, summary });
}
