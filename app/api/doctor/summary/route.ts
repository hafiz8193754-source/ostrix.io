import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedDoctor } from "@/lib/doctorGuard";
import { callEndSchema } from "@/lib/schemas";
import { getConsultation } from "@/lib/clinical";
import { generateVisitSummary } from "@/lib/clinicalAI";

export const maxDuration = 30;

const summaryRequestSchema = callEndSchema.pick({ consultation_id: true }).extend({ doctor_notes: z.string().trim().min(1) });

export async function POST(request: Request) {
  const guard = await requireVerifiedDoctor(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await request.json();
  const parsed = summaryRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const consultation = await getConsultation(guard.db, parsed.data.consultation_id);
  if (!consultation) return NextResponse.json({ error: "Consultation not found." }, { status: 404 });
  if (consultation.doctor_id !== guard.doctor.id)
    return NextResponse.json({ error: "You are not the doctor for this consultation." }, { status: 403 });

  try {
    const summary = await generateVisitSummary(guard.db, parsed.data.consultation_id, parsed.data.doctor_notes);
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: "Could not generate the summary right now." }, { status: 502 });
  }
}
