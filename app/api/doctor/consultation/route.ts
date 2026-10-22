import { NextResponse } from "next/server";
import { paymentGateError } from "@/lib/paymentGate";
import { z } from "zod";
import { requireVerifiedDoctor } from "@/lib/doctorGuard";
import { getAppointmentWithParties, getOrCreateConsultation, logClinicalAudit, updateAppointmentStatus } from "@/lib/clinical";
import { createNotification } from "@/lib/notifications";

const startSchema = z.object({ appointment_id: z.string().uuid() });

// Starts (or resumes) a visit without a phone bridge — walk-ins, video/WhatsApp
// calls made outside the app, or when Twilio isn't available. The visit then
// follows the normal path: /api/doctor/call/end (notes) -> prescription/draft -> review.
export async function POST(request: Request) {
  const guard = await requireVerifiedDoctor(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = startSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const parties = await getAppointmentWithParties(guard.db, parsed.data.appointment_id);
  if (!parties) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  if (parties.doctor.id !== guard.doctor.id)
    return NextResponse.json({ error: "You are not the doctor for this appointment." }, { status: 403 });
  if (["cancelled", "no_show"].includes(parties.appointment.status))
    return NextResponse.json({ error: "This appointment was cancelled." }, { status: 400 });

  const gate = paymentGateError(parties.appointment, "in_progress");
  if (gate) return NextResponse.json({ error: gate.error, code: "payment_pending" }, { status: gate.status });

  const consultation = await getOrCreateConsultation(guard.db, parties.appointment.id, guard.doctor.id, parties.patient.id);
  if (!consultation) return NextResponse.json({ error: "Could not start the visit." }, { status: 500 });

  if (!consultation.call_started_at) {
    await guard.db.from("consultations").update({ call_started_at: new Date().toISOString() }).eq("id", consultation.id);
  }
  if (parties.appointment.status !== "in_progress" && parties.appointment.status !== "completed") {
    await updateAppointmentStatus(guard.db, parties.appointment.id, "in_progress");
    if (parties.patient.user_id) {
      try {
        await createNotification(
          guard.db,
          parties.patient.user_id,
          "appointment_updated",
          "Your visit has started",
          `Dr. ${guard.doctor.full_name.replace(/^dr\.?\s+/i, "")} has started your visit.`,
          "/my-care"
        );
      } catch {
        // non-fatal
      }
    }
  }
  await logClinicalAudit(guard.db, consultation.id, null, "doctor", "visit_started", { appointment_id: parties.appointment.id });

  return NextResponse.json({ consultation_id: consultation.id });
}
