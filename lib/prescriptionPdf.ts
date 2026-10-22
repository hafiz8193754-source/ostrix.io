import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { Doctor, Patient, Prescription } from "@/types";

const PAGE_WIDTH = 595; // A4 in points
const PAGE_HEIGHT = 842;
const MARGIN = 50;

// The one PDF renderer, shared by the on-demand download route
// (app/api/doctor/prescription/pdf/route.ts) and approval-time storage
// (app/api/doctor/prescription/review/route.ts) — extracted so there's a
// single source of truth for what a signed prescription PDF looks like.
export async function buildPrescriptionPdf(prescription: Prescription, doctor: Doctor, patient: Patient): Promise<Uint8Array> {
  if (!prescription.final_prescription) throw new Error("Prescription has not been approved yet.");
  const rx = prescription.final_prescription;

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;
  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.4, 0.4, 0.4);
  const accent = rgb(0.85, 0.35, 0);

  function line(text: string, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const { size = 10, f = font, color = black, gap = 14 } = opts;
    page.drawText(text, { x: MARGIN, y, size, font: f, color, maxWidth: PAGE_WIDTH - MARGIN * 2 });
    y -= gap;
  }

  // Header
  line(doctor.full_name, { size: 16, f: bold, gap: 18 });
  line(doctor.qualifications, { size: 10, color: gray });
  line(`PMDC #${doctor.pmdc_number}`, { size: 10, color: gray });
  if (doctor.clinic_name) line(doctor.clinic_name, { size: 10, color: gray });
  if (doctor.clinic_address) line(doctor.clinic_address, { size: 10, color: gray });
  line(`Phone: ${doctor.phone}`, { size: 10, color: gray, gap: 20 });

  page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 6 }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 14;

  // Patient info
  line(`Patient: ${patient.full_name}, ${patient.gender || "—"}, ${patient.age ?? "—"} years`, { size: 11, f: bold, gap: 16 });
  line(`Date: ${new Date(prescription.doctor_signed_at || prescription.created_at).toLocaleDateString()}`, { size: 10, color: gray, gap: 20 });

  line(`Diagnosis: ${rx.diagnosis}`, { size: 11, f: bold, gap: 22 });

  // Medications
  line("Rx", { size: 13, f: bold, color: accent, gap: 18 });
  rx.medications.forEach((med, i) => {
    line(`${i + 1}. ${med.name}`, { size: 11, f: bold, gap: 14 });
    line(`   ${med.dosage} · ${med.frequency} · ${med.duration} (${med.route})`, { size: 9.5, color: gray, gap: 13 });
    if (med.instructions) line(`   ${med.instructions}`, { size: 9.5, color: gray, gap: 13 });
    y -= 4;
  });

  if (rx.lab_tests.length) {
    y -= 6;
    line("Lab Tests", { size: 11, f: bold, gap: 14 });
    rx.lab_tests.forEach((t) => line(`- ${t.name} (${t.reason})`, { size: 9.5, gap: 12 }));
  }

  if (rx.advice.length) {
    y -= 6;
    line("Advice", { size: 11, f: bold, gap: 14 });
    rx.advice.forEach((a) => line(`- ${a}`, { size: 9.5, gap: 12 }));
  }

  y -= 6;
  if (rx.follow_up) line(`Follow-up: ${rx.follow_up}`, { size: 10, gap: 14 });
  if (rx.emergency_instructions) line(`Go to ER if: ${rx.emergency_instructions}`, { size: 10, color: accent, gap: 20 });

  // Signature
  y -= 10;
  line(`Digitally signed by ${doctor.full_name}`, { size: 9.5, f: bold, gap: 12 });
  line(`PMDC #${doctor.pmdc_number} · Verified at pmdc.org.pk`, { size: 8.5, color: gray, gap: 12 });
  line(`Signature hash: ${(prescription.doctor_signature_hash || "").slice(0, 32)}…`, { size: 7.5, color: gray, gap: 20 });

  // Footer + disclaimer
  const footerY = MARGIN + 60;
  page.drawText(
    `This prescription was generated with AI assistance and reviewed, edited, and approved by the above-named PMDC-registered doctor. AI Ref: ${prescription.id}. Generated via Ostrix Clinical.`,
    { x: MARGIN, y: footerY, size: 7, font, color: gray, maxWidth: PAGE_WIDTH - MARGIN * 2 - 90, lineHeight: 9 }
  );
  page.drawText(
    "This is a digitally signed prescription. Verify doctor's registration at pmdc.org.pk. In case of adverse reaction, contact your doctor immediately or call 1122.",
    { x: MARGIN, y: footerY - 24, size: 7, font, color: gray, maxWidth: PAGE_WIDTH - MARGIN * 2 - 90, lineHeight: 9 }
  );

  // QR code (verification) — bottom right
  const qrPng = await QRCode.toBuffer(prescription.id, { type: "png", margin: 0, width: 80 });
  const qrImage = await doc.embedPng(qrPng);
  page.drawImage(qrImage, { x: PAGE_WIDTH - MARGIN - 70, y: footerY - 30, width: 70, height: 70 });

  return doc.save();
}
