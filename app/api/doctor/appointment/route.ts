import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { appointmentBookingSchema, appointmentUpdateSchema } from "@/lib/schemas";
import { getOrCreatePatientForUser, createAppointment, getDoctorById, getAppointmentWithParties, updateAppointmentStatus, logClinicalAudit } from "@/lib/clinical";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const body = await request.json();
  const parsed = appointmentBookingSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { doctor_id, date, time, type, symptoms_description, ai_analysis, session_id, patient } = parsed.data;

  const doctor = await getDoctorById(db, doctor_id);
  if (!doctor || !doctor.is_active || !doctor.pmdc_verified)
    return NextResponse.json({ error: "That doctor isn't available for booking." }, { status: 400 });

  const patientRow = await getOrCreatePatientForUser(db, user.id, patient);
  if (!patientRow) return NextResponse.json({ error: "Could not save your patient profile." }, { status: 500 });

  const appointment = await createAppointment(db, {
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

  await logClinicalAudit(db, null, null, "patient", "appointment_booked", { appointment_id: appointment.id, doctor_id });
  if (doctor.user_id && doctor.user_id !== user.id) {
    try {
      await createNotification(
        db,
        doctor.user_id,
        "appointment_booked",
        "New appointment",
        `${patient.full_name} booked ${type === "online" ? "an online visit" : "a walk-in"} on ${date} at ${time}.`,
        "/doctor/dashboard"
      );
    } catch {
      // The booking stands even if the doctor's notification is rejected.
    }
  }

  return NextResponse.json({
    appointment,
    confirmation_message:
      appointment.fee_pkr > 0
        ? `Booked with Dr. ${doctor.full_name} on ${date} at ${time}. Please pay the PKR ${appointment.fee_pkr.toLocaleString()} fee by bank transfer from My care — your booking is confirmed once the transfer is verified.`
        : `Booked with Dr. ${doctor.full_name} on ${date} at ${time}. The clinic will confirm via WhatsApp/phone shortly.`,
  });
}

const PATIENT_STATUSES = new Set(["cancelled"]);
const DOCTOR_STATUSES = new Set(["confirmed", "in_progress", "completed", "cancelled", "no_show"]);

export async function PATCH(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const body = await request.json();
  const parsed = appointmentUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const parties = await getAppointmentWithParties(db, parsed.data.appointment_id);
  if (!parties) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

  const isPatient = user.id === parties.patient.user_id;
  const isDoctor = user.id === parties.doctor.user_id;
  if (!isPatient && !isDoctor) return NextResponse.json({ error: "You're not part of this appointment." }, { status: 403 });

  const allowed = isDoctor ? DOCTOR_STATUSES : PATIENT_STATUSES;
  if (!allowed.has(parsed.data.status))
    return NextResponse.json({ error: "You can't set that appointment status." }, { status: 403 });

  const appointment = await updateAppointmentStatus(db, parsed.data.appointment_id, parsed.data.status);
  if (!appointment) return NextResponse.json({ error: "Could not update the appointment." }, { status: 500 });

  const otherUserId = isDoctor ? parties.patient.user_id : parties.doctor.user_id;
  if (otherUserId && otherUserId !== user.id) {
    try {
      await createNotification(
        db,
        otherUserId,
        "appointment_updated",
        "Appointment updated",
        `The visit on ${parties.appointment.appointment_date} is now ${parsed.data.status.replace(/_/g, " ")}.`,
        isDoctor ? "/my-care" : "/doctor/dashboard"
      );
    } catch {
      // Status change stands even if the other party can't be notified yet.
    }
  }

  await logClinicalAudit(db, null, null, isDoctor ? "doctor" : "patient", "appointment_updated", {
    appointment_id: appointment.id,
    status: appointment.status,
  });

  return NextResponse.json({ appointment });
}
