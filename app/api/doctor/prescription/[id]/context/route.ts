import { NextResponse } from "next/server";
import { requireVerifiedDoctor } from "@/lib/doctorGuard";
import { getPrescription, getConsultation, getAppointmentWithParties } from "@/lib/clinical";

interface RouteParams {
  params: { id: string };
}

// Backs the review screen's read-only "patient intake" / "call transcript"
// panels — doctor-gated, and only for the doctor actually assigned to this
// prescription (not just any verified doctor).
export async function GET(request: Request, { params }: RouteParams) {
  const guard = await requireVerifiedDoctor(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const prescription = await getPrescription(params.id);
  if (!prescription) return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
  if (prescription.doctor_id !== guard.doctor.id)
    return NextResponse.json({ error: "You are not the doctor for this prescription." }, { status: 403 });

  const consultation = await getConsultation(prescription.consultation_id);
  if (!consultation) return NextResponse.json({ consultation: null, appointment: null });

  const parties = await getAppointmentWithParties(consultation.appointment_id);
  return NextResponse.json({ consultation, appointment: parties?.appointment || null });
}
