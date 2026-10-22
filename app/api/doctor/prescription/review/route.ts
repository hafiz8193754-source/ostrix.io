import { NextResponse } from "next/server";
import { getUserFromRequest, appendMessage } from "@/lib/serverAuth";
import { prescriptionReviewSchema } from "@/lib/schemas";
import {
  verifyDoctorForPrescription,
  approvePrescription,
  rejectPrescription,
  editPrescription,
  logClinicalAudit,
  getPatientById,
  getConsultation,
  getAppointmentWithParties,
  uploadPrescriptionPdf,
  savePrescriptionPdfUrl,
} from "@/lib/clinical";
import { buildPrescriptionPdf } from "@/lib/prescriptionPdf";
import { createNotification } from "@/lib/notifications";

// The most safety-critical endpoint in this module. A prescription can NEVER
// reach the patient without passing through here, and this route can only be
// invoked successfully by the exact PMDC-verified doctor assigned to it.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = prescriptionReviewSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { prescription_id, action, edited_prescription, rejection_reason, signature_data } = parsed.data;

  const verified = await verifyDoctorForPrescription(user.id, prescription_id);
  if (!verified)
    return NextResponse.json({ error: "You are not authorized to review this prescription." }, { status: 403 });
  const { doctor, prescription } = verified;

  if (action === "approve") {
    if (!signature_data || !signature_data.trim())
      return NextResponse.json({ error: "A signature is required to approve a prescription." }, { status: 400 });

    const finalContent = edited_prescription || prescription.doctor_edited_prescription || prescription.ai_generated_prescription;
    const result = await approvePrescription(prescription_id, doctor.id, finalContent);
    if (!result) return NextResponse.json({ error: "Could not approve the prescription." }, { status: 500 });

    await logClinicalAudit(prescription.consultation_id, prescription_id, "doctor", "prescription_approved", {
      changedFromAiDraft: JSON.stringify(finalContent) !== JSON.stringify(prescription.ai_generated_prescription),
    });

    // Best-effort: the approval itself already succeeded above. Storing a
    // durable PDF copy, notifying the patient, and dropping a message into
    // their chat are conveniences — a failure here must never undo the approval.
    try {
      const patient = await getPatientById(result.prescription.patient_id);
      if (patient) {
        const pdfBytes = await buildPrescriptionPdf(result.prescription, doctor, patient);
        const pdfPath = `${doctor.id}/${result.prescription.id}.pdf`;
        await uploadPrescriptionPdf(pdfPath, Buffer.from(pdfBytes));
        await savePrescriptionPdfUrl(result.prescription.id, pdfPath);

        if (patient.user_id) {
          await createNotification(
            patient.user_id,
            "prescription_ready",
            "Your prescription is ready",
            `Dr. ${doctor.full_name} has approved your prescription.`,
            "/studio"
          );

          const consultation = await getConsultation(prescription.consultation_id);
          const parties = consultation ? await getAppointmentWithParties(consultation.appointment_id) : null;
          const sessionId = parties?.appointment.session_id;
          if (sessionId) {
            await appendMessage(sessionId, "agent", {
              role: "agent",
              text: `Dr. ${doctor.full_name} has approved your prescription for "${finalContent.diagnosis}". Open it from your notifications to view or download the PDF.`,
            });
          }
        }
      }
    } catch {
      // Non-fatal — approval stands even if PDF storage/notification/chat delivery fails.
    }

    return NextResponse.json({ prescription: result.prescription });
  }

  if (action === "reject") {
    if (!rejection_reason || !rejection_reason.trim())
      return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });

    const result = await rejectPrescription(prescription_id, rejection_reason);
    if (!result) return NextResponse.json({ error: "Could not reject the prescription." }, { status: 500 });

    await logClinicalAudit(prescription.consultation_id, prescription_id, "doctor", "prescription_rejected", { rejection_reason });
    return NextResponse.json({ prescription: result.prescription });
  }

  // action === "edit" — doctor must still approve after editing (returns to review state)
  if (!edited_prescription) return NextResponse.json({ error: "No changes provided." }, { status: 400 });

  const result = await editPrescription(prescription_id, edited_prescription);
  if (!result) return NextResponse.json({ error: "Could not save the edit." }, { status: 500 });

  await logClinicalAudit(prescription.consultation_id, prescription_id, "doctor", "prescription_edited", {
    before: prescription.doctor_edited_prescription || prescription.ai_generated_prescription,
    after: edited_prescription,
  });

  return NextResponse.json({ prescription: result.prescription });
}
