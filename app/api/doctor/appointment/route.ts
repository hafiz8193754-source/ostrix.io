import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { appointmentBookingSchema } from "@/lib/schemas";
import { getOrCreatePatientForUser, createAppointment, getDoctorById, logClinicalAudit } from "@/lib/clinical";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = appointmentBookingSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { doctor_id, date, time, type, symptoms_description, ai_analysis, session_id, patient } = parsed.data;

  const doctor = await getDoctorById(doctor_id);
  if (!doctor || !doctor.is_active || !doctor.pmdc_verified)
    return NextResponse.json({ error: "That doctor isn't available for booking." }, { status: 400 });

  const patientRow = await getOrCreatePatientForUser(user.id, patient);
  if (!patientRow) return NextResponse.json({ error: "Could not save your patient profile." }, { status: 500 });

  const appointment = await createAppointment({
    patient_id: patientRow.id,
    doctor_id,
    appointment_date: date,
    appointment_time: time,
    type,
    symptoms_description: symptoms_description || undefined,
    ai_suggested_specialization: typeof ai_analysis?.suggested_specialization === "string" ? ai_analysis.suggested_specialization : undefined,
    ai_symptom_analysis: ai_analysis,
    session_id,
  });
  if (!appointment) return NextResponse.json({ error: "Could not book the appointment." }, { status: 500 });

  await logClinicalAudit(null, null, "patient", "appointment_booked", { appointment_id: appointment.id, doctor_id });

  return NextResponse.json({
    appointment,
    confirmation_message: `Booked with Dr. ${doctor.full_name} on ${date} at ${time}. The clinic will confirm via WhatsApp/phone shortly.`,
  });
}
