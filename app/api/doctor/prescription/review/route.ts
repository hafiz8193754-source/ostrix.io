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
  createPrescriptionRevision,
} from "@/lib/clinical";
import { buildPrescriptionPdf } from "@/lib/prescriptionPdf";
import { createNotification } from "@/lib/notifications";

// The most safety-critical endpoint in this module. A prescription can NEVER
// reach the patient without passing through here, and this route can only be
// invoked successfully by the exact PMDC-verified doctor assigned to it.
export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const body = await request.json();
  const parsed = prescriptionReviewSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { prescription_id, action, edited_prescription, rejection_reason, signature_data } = parsed.data;

  const verified = await verifyDoctorForPrescription(db, user.id, prescription_id);
  if (!verified)
    return NextResponse.json({ error: "You are not authorized to review this prescription." }, { status: 403 });
  const { doctor, prescription } = verified;

  const OPEN = ["draft", "pending_review", "revised"];
  if (action === "revise") {
    if (prescription.status !== "approved")
      return NextResponse.json({ error: "Only a signed prescription can be revised." }, { status: 409 });
    const revision = await createPrescriptionRevision(db, prescription);
    if (!revision) return NextResponse.json({ error: "Could not create a new version." }, { status: 500 });
    await logClinicalAudit(db, prescription.consultation_id, revision.id, "doctor", "prescription_revision_opened", { supersedes: prescription.id });
    return NextResponse.json({ prescription: revision });
  }
  if (!OPEN.includes(prescription.status))
    return NextResponse.json(
      { error: prescription.status === "approved" ? "This prescription is signed and locked. Create a new version to change it." : "This prescription can no longer be changed." },
      { status: 409 }
    );

  if (action === "approve") {
    if (!signature_data || !signature_data.trim())
      return NextResponse.json({ error: "A signature is required to approve a prescription." }, { status: 400 });

    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(signature_data.trim());
    if (!m) return NextResponse.json({ error: "The signature must be a PNG image." }, { status: 400 });
    const png = Buffer.from(m[1], "base64");
    if (png.length < 100 || png.length > 600_000) return NextResponse.json({ error: "Invalid signature image." }, { status: 400 });
    // A per-prescription copy of the exact signature used, in the private bucket.
    const signaturePath = `${doctor.user_id}/signed/${prescription_id}.png`;
    const { error: sigErr } = await db.storage.from("signatures").upload(signaturePath, png, { upsert: true, contentType: "image/png" });
    if (sigErr) return NextResponse.json({ error: "Could not store the signature." }, { status: 500 });

    const finalContent = edited_prescription || prescription.doctor_edited_prescription || prescription.ai_generated_prescription;
    const result = await approvePrescription(db, prescription, { doctor, finalContent, signaturePath });
    if (!result) return NextResponse.json({ error: "Could not approve the prescription." }, { status: 500 });

    await logClinicalAudit(db, prescription.consultation_id, prescription_id, "doctor", "prescription_approved", {
      changedFromAiDraft: JSON.stringify(finalContent) !== JSON.stringify(prescription.ai_generated_prescription),
    });

    // Best-effort: the approval itself already succeeded above. Storing a
    // durable PDF copy, notifying the patient, and dropping a message into
    // their chat are conveniences — a failure here must never undo the approval.
    try {
      const patient = await getPatientById(db, result.prescription.patient_id);
      if (patient) {
        const pdfBytes = await buildPrescriptionPdf(result.prescription, doctor, patient);
        const pdfPath = `${doctor.id}/${result.prescription.id}.pdf`;
        await uploadPrescriptionPdf(db, pdfPath, Buffer.from(pdfBytes));
        await savePrescriptionPdfUrl(db, result.prescription.id, pdfPath);

        if (patient.user_id) {
          await createNotification(db, 
            patient.user_id,
            "prescription_ready",
            "Your prescription is ready",
            `Dr. ${doctor.full_name} has approved your prescription.`,
            "/my-care"
          );

          const consultation = await getConsultation(db, prescription.consultation_id);
          const parties = consultation ? await getAppointmentWithParties(db, consultation.appointment_id) : null;
          const sessionId = parties?.appointment.session_id;
          if (sessionId) {
            await appendMessage(db, sessionId, "agent", {
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

    const result = await rejectPrescription(db, prescription_id, rejection_reason);
    if (!result) return NextResponse.json({ error: "Could not reject the prescription." }, { status: 500 });

    await logClinicalAudit(db, prescription.consultation_id, prescription_id, "doctor", "prescription_rejected", { rejection_reason });
    return NextResponse.json({ prescription: result.prescription });
  }

  // action === "edit" — doctor must still approve after editing (returns to review state)
  if (!edited_prescription) return NextResponse.json({ error: "No changes provided." }, { status: 400 });

  const result = await editPrescription(db, prescription_id, edited_prescription);
  if (!result) return NextResponse.json({ error: "Could not save the edit." }, { status: 500 });

  await logClinicalAudit(db, prescription.consultation_id, prescription_id, "doctor", "prescription_edited", {
    before: prescription.doctor_edited_prescription || prescription.ai_generated_prescription,
    after: edited_prescription,
  });

  return NextResponse.json({ prescription: result.prescription });
}
