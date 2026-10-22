import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getPrescription, getDoctorById, getPatientById, logClinicalAudit } from "@/lib/clinical";
import { buildPrescriptionPdf } from "@/lib/prescriptionPdf";

export const maxDuration = 30;

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const prescriptionId = searchParams.get("id");
  if (!prescriptionId) return NextResponse.json({ error: "Missing prescription id." }, { status: 400 });

  const prescription = await getPrescription(prescriptionId);
  if (!prescription) return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
  // A prescription is only ever a candidate for PDF export once a doctor has
  // actually signed off on it — draft/pending/rejected content never leaves this door.
  if (prescription.status !== "approved" || !prescription.final_prescription)
    return NextResponse.json({ error: "This prescription has not been approved yet." }, { status: 400 });

  const [doctor, patient] = await Promise.all([getDoctorById(prescription.doctor_id), getPatientById(prescription.patient_id)]);
  if (!doctor || !patient) return NextResponse.json({ error: "Could not load prescription details." }, { status: 500 });

  // This route is fetched by BOTH the assigned doctor (dashboard) and the
  // patient it belongs to (PrescriptionCard's "Download PDF" button) — the
  // gate is ownership, not "is a doctor".
  if (user.id !== doctor.user_id && user.id !== patient.user_id)
    return NextResponse.json({ error: "You don't have access to this prescription." }, { status: 403 });

  const pdfBytes = await buildPrescriptionPdf(prescription, doctor, patient);
  await logClinicalAudit(null, prescription.id, "patient", "prescription_pdf_downloaded", {});

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="prescription-${prescription.id.slice(0, 8)}.pdf"`,
    },
  });
}
