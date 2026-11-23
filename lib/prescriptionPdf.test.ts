import { inflateSync } from "zlib";
import { describe, expect, it } from "vitest";
import { buildPrescriptionPdf, verifyUrl } from "./prescriptionPdf";

const rx = {
  diagnosis: "Dyspepsia",
  medications: [{ name: "Omeprazole 20 mg", dosage: "1 cap", frequency: "Once daily", duration: "14 days", route: "oral", instructions: "Before breakfast", quantity: 14, warnings: [] }],
  lab_tests: [{ name: "H. pylori stool antigen", reason: "if persists" }],
  advice: ["Avoid oily food"],
  follow_up: "2 weeks",
  emergency_instructions: "vomiting blood",
  drug_interaction_warnings: [],
  contraindication_flags: [],
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prescription: any = { id: "p1", status: "approved", final_prescription: rx, doctor_signed_at: "2026-11-04T07:50:00Z", created_at: "2026-11-04T07:40:00Z", doctor_signature_hash: "abcdef0123456789abcdef", content_hash: "deadbeefdeadbeef", verify_code: "ABCDE12345", signed_doctor_name: "Dr. Test", signed_doctor_specialty: "Gastroenterologist", signed_pmdc_number: "T-1" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const doctor: any = { full_name: "Test", specialization: "Gastroenterologist", qualifications: "MBBS", pmdc_number: "T-1", phone: "000" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const patient: any = { full_name: "Pat", age: 30, gender: "male" };

async function pdfText(): Promise<string> {
  const buf = Buffer.from(await buildPrescriptionPdf(prescription, doctor, patient));
  const raw = buf.toString("latin1");
  let out = "";
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = re.exec(raw))) {
    let body: string;
    try { body = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { body = m[1]; }
    body.replace(/<([0-9A-Fa-f]+)>\s*Tj/g, (_s, hex: string) => { out += Buffer.from(hex, "hex").toString("latin1") + "\n"; return ""; });
    body.replace(/\(((?:\\.|[^\\)])*)\)\s*Tj/g, (_s, t: string) => { out += t + "\n"; return ""; });
  }
  return out;
}

describe("prescription PDF (clean clinic layout)", () => {
  it("keeps clinical content, signature and compact verification", async () => {
    const t = await pdfText();
    for (const s of ["Dr. Test", "PMDC", "Pat", "Dyspepsia", "Omeprazole 20 mg", "Avoid oily food", "2 weeks", "Digitally signed", "ABCDE-12345"]) expect(t).toContain(s);
  });

  it("has no disclaimers, AI notes, 1122/ER block or raw hashes", async () => {
    const t = await pdfText();
    for (const bad of [/disclaimer/i, /AI assistance|AI-assisted|AI Ref/i, /1122/, /Go to ER/i, /vomiting blood/, /hash/i, /abcdef0123/, /deadbeef/, /pmdc\.org\.pk/i]) expect(t).not.toMatch(bad);
  });

  it("verification URL points at /verify/<code>", () => {
    expect(verifyUrl("ABCDE12345")).toMatch(/\/verify\/ABCDE12345$/);
  });
});
