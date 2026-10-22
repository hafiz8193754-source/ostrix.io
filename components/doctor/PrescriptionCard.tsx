"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Printer, ShieldCheck } from "lucide-react";
import type { Prescription } from "@/types";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import { PharmacyFinder } from "@/components/pharmacy/PharmacyFinder";

type DoctorLite = { full_name: string; specialization: string; pmdc_number: string; qualifications?: string | null; clinic_name?: string | null; clinic_address?: string | null; city?: string | null };
type PatientLite = { full_name: string; age: number | null; gender: string | null };

interface PrescriptionCardProps {
  prescription: Prescription;
  doctor: DoctorLite;
  patient: PatientLite;
  accessToken: string;
  printable?: boolean;
}

const drName = (n: string) => `Dr. ${n.replace(/^\s*dr\.?\s+/i, "")}`;
const fmtCode = (c: string) => (c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);

export function medicineListText(p: Prescription): string {
  const rx = p.final_prescription;
  if (!rx) return "";
  return rx.medications.map((m, i) => `${i + 1}. ${m.name} — ${m.dosage}, ${m.frequency}, ${m.duration}${m.quantity ? ` (qty ${m.quantity})` : ""}`).join("\n");
}

// Patient-facing SIGNED prescription. Never renders anything that isn't approved.
export function PrescriptionCard({ prescription, doctor, patient, accessToken, printable }: PrescriptionCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const rx = prescription.final_prescription;
  const signed = !!rx && prescription.status === "approved";

  useEffect(() => {
    if (!signed || !prescription.signature_path) return;
    let url: string | null = null;
    fetch(`/api/prescriptions/${prescription.id}/signature`, { headers: { authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          url = URL.createObjectURL(b);
          setSigUrl(url);
        }
      })
      .catch(() => undefined);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [signed, prescription.id, prescription.signature_path, accessToken]);

  if (!signed || !rx) return null;

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/doctor/prescription/pdf?id=${prescription.id}`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await res.blob());
      a.download = `prescription-${prescription.id.slice(0, 8)}.pdf`;
      a.click();
    } catch {
      // retryable
    }
    setDownloading(false);
  }

  const name = prescription.signed_doctor_name || doctor.full_name;
  const specialty = prescription.signed_doctor_specialty || doctor.specialization;
  const pmdc = prescription.signed_pmdc_number;
  const signedAt = prescription.doctor_signed_at ? new Date(prescription.doctor_signed_at) : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div data-testid="signed-prescription" className="flex w-full max-w-[680px] flex-col gap-3 rounded-2xl border border-border bg-white p-5 text-neutral-900 print:max-w-none print:border-0 print:p-0">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <p className="text-base font-bold">{drName(name)}</p>
          <p className="text-xs text-neutral-600">{specialty}{doctor.qualifications ? ` · ${doctor.qualifications}` : ""}</p>
          <p className="text-xs text-neutral-600">{pmdc ? `PMDC Reg. #${pmdc}` : "PMDC number not on file"}</p>
          {doctor.clinic_name && <p className="text-xs text-neutral-500">{doctor.clinic_name}{doctor.city ? `, ${doctor.city}` : ""}</p>}
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <ShieldCheck className="h-3 w-3" /> Digitally signed
          </span>
          <p className="mt-1 text-xs text-neutral-600">{signedAt ? signedAt.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" }) : ""}</p>
          {(prescription.version ?? 1) > 1 && <p className="text-[11px] text-neutral-500">Version {prescription.version}</p>}
        </div>
      </div>

      <p className="text-sm text-neutral-700">Patient: {patient.full_name}{patient.gender ? `, ${patient.gender}` : ""}{patient.age ? `, ${patient.age} y` : ""}</p>
      {rx.diagnosis && <p className="text-sm font-medium">Diagnosis: {rx.diagnosis}</p>}

      <div className="rounded-xl border border-neutral-200 p-3.5">
        <p className="mb-2 font-serif text-lg font-bold">℞</p>
        <ol className="flex flex-col gap-2">
          {rx.medications.map((m, i) => (
            <li key={i} data-testid="rx-med" className="text-sm">
              <p className="font-medium">{i + 1}. {m.name}</p>
              <p className="text-xs text-neutral-600">{m.dosage} · {m.frequency} · {m.duration}{m.route ? ` · ${m.route}` : ""}</p>
              {m.instructions && <p className="text-xs text-neutral-500">{m.instructions}</p>}
            </li>
          ))}
        </ol>
      </div>

      {rx.treatment_plan && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Treatment plan</p>
          <p data-testid="rx-plan" className="whitespace-pre-wrap text-sm text-neutral-700">{rx.treatment_plan}</p>
        </div>
      )}
      {rx.lab_tests.length > 0 && <p className="text-sm text-neutral-700">Lab tests: {rx.lab_tests.map((t) => t.name).join(", ")}</p>}
      {rx.advice.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Advice</p>
          <ul className="text-sm text-neutral-700">{rx.advice.map((a, i) => <li key={i}>• {a}</li>)}</ul>
        </div>
      )}
      {rx.follow_up && <p className="text-sm text-neutral-700">Follow-up: {rx.follow_up}</p>}
      {rx.emergency_instructions && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700">Go to emergency / call 1122 if: {rx.emergency_instructions}</p>}

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-neutral-200 pt-3">
        <div className="text-[11px] text-neutral-600">
          {prescription.verify_code && (
            <>
              <p>Verification code: <span data-testid="rx-verify-code" className="font-mono text-sm font-bold text-neutral-900">{fmtCode(prescription.verify_code)}</span></p>
              <p>Verify at <Link href={`/verify/${prescription.verify_code}`} className="underline">{origin.replace(/^https?:\/\//, "")}/verify/{prescription.verify_code}</Link></p>
            </>
          )}
          {prescription.content_hash && <p className="font-mono">SHA-256 {prescription.content_hash.slice(0, 16)}…</p>}
        </div>
        <div className="flex flex-col items-center">
          {sigUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img data-testid="rx-signature" src={sigUrl} alt="Doctor's signature" className="h-14 w-40 object-contain" />
          ) : (
            <div className="h-14 w-40" />
          )}
          <p className="border-t border-neutral-400 px-4 text-[11px] text-neutral-600">{drName(name)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {printable ? (
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-fg">
            <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
          </button>
        ) : (
          <Link data-testid="rx-printable" href={`/rx/${prescription.id}`} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-neutral-700">
            <Printer className="h-3.5 w-3.5" /> Printable view
          </Link>
        )}
        <button onClick={downloadPdf} disabled={downloading} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-neutral-700 disabled:opacity-60">
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download PDF
        </button>
      </div>

      {!printable && <PharmacyFinder accessToken={accessToken} medicineList={`Prescription ${prescription.verify_code ? fmtCode(prescription.verify_code) : ""} (${drName(name)})\n${medicineListText(prescription)}`} />}

      <p className="text-[10px] text-neutral-500">AI-assisted draft reviewed, edited and signed by the doctor. {CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
