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
export function verifyUrl(code: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://ostrix-io.vercel.app").replace(/\/$/, "");
  return `${base}/verify/${code}`;
}

export function formatVerifyCode(c: string): string {
  return c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
}

const withDr = (n: string) => (/^dr\.?\s/i.test(n.trim()) ? n.trim() : `Dr. ${n.trim()}`);

export async function buildPrescriptionPdf(prescription: Prescription, doctor: Doctor, patient: Patient): Promise<Uint8Array> {
  if (!prescription.final_prescription) throw new Error("Prescription has not been approved yet.");
  const rx = prescription.final_prescription;

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  type F = typeof font;

  const ink = rgb(0.11, 0.12, 0.14);
  const muted = rgb(0.42, 0.44, 0.48);
  const rule = rgb(0.86, 0.87, 0.89);
  const brand = rgb(0.06, 0.46, 0.43);
  const right = PAGE_WIDTH - MARGIN;
  const width = right - MARGIN;

  const name = withDr(prescription.signed_doctor_name || doctor.full_name);
  const specialty = prescription.signed_doctor_specialty || doctor.specialization;
  const pmdc = prescription.signed_pmdc_number || doctor.pmdc_number;
  const date = new Date(prescription.doctor_signed_at || prescription.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" });

  function wrap(text: string, f: F, size: number, max: number): string[] {
    const out: string[] = [];
    let cur = "";
    for (const w of String(text || "").split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > max && cur) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  }
  function text(t: string, x: number, yy: number, size: number, f: F = font, color = ink) {
    page.drawText(t, { x, y: yy, size, font: f, color });
  }
  function textRight(t: string, yy: number, size: number, f: F = font, color = ink) {
    text(t, right - f.widthOfTextAtSize(t, size), yy, size, f, color);
  }
  function hr(yy: number, thickness = 0.75, color = rule) {
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: right, y: yy }, thickness, color });
  }
  function heading(t: string) {
    text(t.toUpperCase(), MARGIN, y, 8.5, bold, muted);
    y -= 15;
  }

  // Header
  let y = PAGE_HEIGHT - MARGIN;
  text(name, MARGIN, y - 4, 18, bold);
  textRight("OSTRIX", y - 4, 11, bold, brand);
  y -= 22;
  text([specialty, doctor.qualifications].filter(Boolean).join("  |  "), MARGIN, y, 9.5, font, muted);
  textRight(date, y, 9.5, font, muted);
  y -= 13;
  text(`PMDC Reg. No. ${pmdc}`, MARGIN, y, 9.5, font, muted);
  y -= 13;
  const clinic = [doctor.clinic_name, doctor.clinic_address, doctor.city].filter(Boolean).join(", ");
  if (clinic) { text(clinic, MARGIN, y, 9.5, font, muted); y -= 13; }
  y -= 4;
  hr(y, 1.5, brand);
  y -= 20;

  // Patient
  const ageSex = [patient.age != null ? `${patient.age} years` : "", patient.gender ? patient.gender[0].toUpperCase() + patient.gender.slice(1) : ""].filter(Boolean).join(" / ");
  text("Patient", MARGIN, y, 8.5, bold, muted);
  text("Age / Sex", MARGIN + 260, y, 8.5, bold, muted);
  text("Date", MARGIN + 390, y, 8.5, bold, muted);
  y -= 13;
  text(patient.full_name, MARGIN, y, 11, bold);
  text(ageSex || "-", MARGIN + 260, y, 11);
  text(date, MARGIN + 390, y, 11);
  y -= 22;

  if (rx.diagnosis) {
    heading("Diagnosis");
    for (const l of wrap(rx.diagnosis, font, 11, width)) { text(l, MARGIN, y, 11); y -= 14; }
    y -= 10;
  }

  // Medicines table
  text("Rx", MARGIN, y, 16, bold, brand);
  y -= 18;
  const cols = [MARGIN, MARGIN + 22, MARGIN + 230, MARGIN + 300, MARGIN + 430];
  const headers = ["#", "Medicine", "Dose", "Frequency", "Duration"];
  page.drawRectangle({ x: MARGIN, y: y - 5, width, height: 18, color: rgb(0.95, 0.96, 0.96) });
  headers.forEach((h, i) => text(h, cols[i] + 4, y, 8.5, bold, muted));
  y -= 20;
  rx.medications.forEach((m, i) => {
    const nameLines = wrap(m.name, bold, 10, 200);
    const freqLines = wrap(m.frequency, font, 9.5, 124);
    const doseLines = wrap(m.dosage, font, 9.5, 66);
    const instr = [m.route, m.instructions].filter(Boolean).join(" · ");
    const instrLines = instr ? wrap(instr, font, 8.5, 200) : [];
    const top = y;
    text(String(i + 1), cols[0] + 4, top, 10, bold);
    nameLines.forEach((l, k) => text(l, cols[1] + 4, top - k * 12.5, 10, bold));
    instrLines.forEach((l, k) => text(l, cols[1] + 4, top - nameLines.length * 12.5 - k * 11, 8.5, font, muted));
    doseLines.forEach((l, k) => text(l, cols[2] + 4, top - k * 12, 9.5));
    freqLines.forEach((l, k) => text(l, cols[3] + 4, top - k * 12, 9.5));
    text(m.duration, cols[4] + 4, top, 9.5);
    const h = Math.max(nameLines.length * 12.5 + instrLines.length * 11, freqLines.length * 12, doseLines.length * 12);
    y = top - h - 6;
    hr(y + 2);
    y -= 12;
  });
  y -= 6;

  if (rx.lab_tests.length) {
    heading("Investigations");
    rx.lab_tests.forEach((t) => {
      for (const l of wrap(`•  ${t.name}${t.reason ? ` (${t.reason})` : ""}`, font, 10, width)) { text(l, MARGIN, y, 10); y -= 13; }
    });
    y -= 8;
  }
  if (rx.advice.length) {
    heading("Advice");
    rx.advice.forEach((a) => {
      for (const l of wrap(`•  ${a}`, font, 10, width)) { text(l, MARGIN, y, 10); y -= 13; }
    });
    y -= 8;
  }
  if (rx.follow_up) {
    heading("Follow-up");
    for (const l of wrap(rx.follow_up, font, 10, width)) { text(l, MARGIN, y, 10); y -= 13; }
  }

  // Signature block (bottom right) + compact verification (bottom left)
  const baseY = MARGIN + 10;
  const sigX = right - 190;
  page.drawLine({ start: { x: sigX, y: baseY + 52 }, end: { x: right, y: baseY + 52 }, thickness: 0.75, color: muted });
  text(name, sigX, baseY + 38, 10, bold);
  text(`${specialty}  |  PMDC ${pmdc}`, sigX, baseY + 25, 8.5, font, muted);
  text(`Digitally signed  ${date}`, sigX, baseY + 12, 8.5, bold, brand);

  if (prescription.verify_code) {
    const qrPng = await QRCode.toBuffer(verifyUrl(prescription.verify_code), { type: "png", margin: 0, width: 120 });
    const qr = await doc.embedPng(qrPng);
    page.drawImage(qr, { x: MARGIN, y: baseY, width: 56, height: 56 });
    text("Scan to verify", MARGIN + 64, baseY + 30, 8, font, muted);
    text(formatVerifyCode(prescription.verify_code), MARGIN + 64, baseY + 17, 9.5, bold);
  }

  return doc.save();
}
