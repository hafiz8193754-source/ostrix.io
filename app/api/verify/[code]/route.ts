import { NextResponse } from "next/server";
import { createServiceClient, hasServiceRoleKey } from "@/lib/serverAuth";
import { normalizeVerifyCode, prescriptionHash } from "@/lib/signing";
import type { Prescription } from "@/types";

export const dynamic = "force-dynamic";

// Public authenticity check. Returns signer + content integrity only —
// never the patient's name, phone, age or any identifier.
export async function GET(_request: Request, { params }: { params: { code: string } }) {
  const code = normalizeVerifyCode(params.code || "");
  if (code.length !== 10) return NextResponse.json({ valid: false, reason: "invalid_code" }, { status: 404 });
  if (!hasServiceRoleKey()) return NextResponse.json({ error: "Verification is not configured." }, { status: 503 });
  const db = createServiceClient();
  const { data } = await db.from("prescriptions").select("*").eq("verify_code", code).maybeSingle();
  if (!data) return NextResponse.json({ valid: false, reason: "not_found" }, { status: 404 });
  const rx = data as Prescription;
  const content = rx.final_prescription;
  const recomputed =
    content && rx.doctor_signed_at && rx.signed_by_doctor_id
      ? prescriptionHash({
          prescription_id: rx.id,
          version: rx.version ?? 1,
          doctor_id: rx.signed_by_doctor_id,
          pmdc_number: rx.signed_pmdc_number ?? null,
          signed_at: new Date(rx.doctor_signed_at).toISOString(),
          content,
        })
      : null;
  const intact = !!recomputed && recomputed === rx.content_hash;
  let newer: string | null = null;
  if (rx.superseded_by) {
    const { data: n } = await db.from("prescriptions").select("verify_code").eq("id", rx.superseded_by).maybeSingle();
    newer = n?.verify_code ?? null;
  }
  return NextResponse.json({
    valid: rx.status === "approved" && intact,
    status: rx.status,
    integrity: intact ? "intact" : rx.signed_by_doctor_id ? "mismatch" : "unverifiable",
    superseded_by_code: newer,
    version: rx.version ?? 1,
    signed_at: rx.doctor_signed_at,
    doctor: { name: rx.signed_doctor_name, specialty: rx.signed_doctor_specialty, pmdc_number: rx.signed_pmdc_number },
    content_hash: rx.content_hash,
    medicines: (content?.medications || []).map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, duration: m.duration })),
  });
}
