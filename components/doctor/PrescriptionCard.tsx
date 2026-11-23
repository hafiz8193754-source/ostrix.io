"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Printer, QrCode, ShieldCheck } from "lucide-react";
import type { Prescription } from "@/types";
import { PharmacyFinder } from "@/components/pharmacy/PharmacyFinder";
import { doctorName } from "@/lib/doctorDisplay";

type DoctorLite = { full_name: string; specialization: string; pmdc_number: string; qualifications?: string | null; clinic_name?: string | null; clinic_address?: string | null; city?: string | null };
type PatientLite = { full_name: string; age: number | null; gender: string | null };

interface PrescriptionCardProps {
  prescription: Prescription;
  doctor: DoctorLite;
  patient: PatientLite;
  accessToken: string;
  printable?: boolean;
}

const drName = (n: string) => doctorName(n);
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
  const dateText = signedAt ? signedAt.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" }) : "";
  const ageSex = [patient.age ? `${patient.age} years` : "", patient.gender ? patient.gender[0].toUpperCase() + patient.gender.slice(1) : ""].filter(Boolean).join(" / ");
  const label = "text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500";

  return (
    <div data-testid="signed-prescription" className="flex w-full max-w-[720px] flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-sm sm:p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 border-b-2 border-teal-700 pb-4">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight sm:text-xl">{drName(name)}</p>
          <p className="mt-1 text-xs text-neutral-600 sm:text-sm">{specialty}{doctor.qualifications ? ` · ${doctor.qualifications}` : ""}</p>
          {pmdc && <p className="text-xs text-neutral-600 sm:text-sm">PMDC Reg. No. {pmdc}</p>}
          {doctor.clinic_name && <p className="text-xs text-neutral-500 sm:text-sm">{doctor.clinic_name}{doctor.city ? `, ${doctor.city}` : ""}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-extrabold tracking-[0.2em] text-teal-700">OSTRIX</p>
          <p className="mt-1 text-xs text-neutral-600">{dateText}</p>
          {(prescription.version ?? 1) > 1 && <p className="text-[11px] text-neutral-500">Version {prescription.version}</p>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-1"><p className={label}>Patient</p><p className="text-sm font-semibold">{patient.full_name}</p></div>
        <div><p className={label}>Age / Sex</p><p className="text-sm">{ageSex || "—"}</p></div>
        <div><p className={label}>Date</p><p className="text-sm">{dateText}</p></div>
      </section>

      {rx.diagnosis && (
        <section><p className={label}>Diagnosis</p><p className="text-sm font-medium">{rx.diagnosis}</p></section>
      )}

      <section>
        <p className="mb-2 font-serif text-2xl font-bold leading-none text-teal-700">℞</p>
        <div className="hidden grid-cols-[1.5rem_2fr_1fr_1.5fr_1fr] gap-3 rounded-md bg-neutral-100 px-3 py-2 sm:grid">
          {["#", "Medicine", "Dose", "Frequency", "Duration"].map((h) => <p key={h} className={label}>{h}</p>)}
        </div>
        <ol className="divide-y divide-neutral-200">
          {rx.medications.map((m, i) => (
            <li key={i} data-testid="rx-med" className="grid grid-cols-[1.5rem_1fr] gap-x-3 px-0 py-3 text-sm sm:grid-cols-[1.5rem_2fr_1fr_1.5fr_1fr] sm:px-3">
              <span className="font-semibold">{i + 1}</span>
              <div>
                <p className="font-semibold">{m.name}</p>
                {(m.route || m.instructions) && <p className="text-xs text-neutral-500">{[m.route, m.instructions].filter(Boolean).join(" · ")}</p>}
                <p className="mt-1 text-xs text-neutral-700 sm:hidden">{m.dosage} · {m.frequency} · {m.duration}</p>
              </div>
              <p className="hidden sm:block">{m.dosage}</p>
              <p className="hidden sm:block">{m.frequency}</p>
              <p className="hidden sm:block">{m.duration}</p>
            </li>
          ))}
        </ol>
      </section>

      {rx.treatment_plan && (
        <section><p className={label}>Treatment plan</p><p data-testid="rx-plan" className="whitespace-pre-wrap text-sm text-neutral-700">{rx.treatment_plan}</p></section>
      )}
      {rx.lab_tests.length > 0 && (
        <section><p className={label}>Investigations</p><ul className="text-sm text-neutral-700">{rx.lab_tests.map((t, i) => <li key={i}>• {t.name}</li>)}</ul></section>
      )}
      {rx.advice.length > 0 && (
        <section><p className={label}>Advice</p><ul className="space-y-0.5 text-sm text-neutral-700">{rx.advice.map((a, i) => <li key={i}>• {a}</li>)}</ul></section>
      )}
      {rx.follow_up && (
        <section><p className={label}>Follow-up</p><p className="text-sm text-neutral-700">{rx.follow_up}</p></section>
      )}

      <footer className="flex items-end justify-between gap-4 pt-4">
        {prescription.verify_code ? (
          <Link href={`/verify/${prescription.verify_code}`} className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-800" title="Verify this prescription">
            <QrCode className="h-4 w-4" aria-hidden />
            <span data-testid="rx-verify-code" className="font-mono font-semibold text-neutral-700">{fmtCode(prescription.verify_code)}</span>
          </Link>
        ) : <span />}
        <div className="flex flex-col items-end text-right">
          {sigUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img data-testid="rx-signature" src={sigUrl} alt="Doctor's signature" className="h-12 w-36 object-contain" />
          ) : (
            <div className="h-10 w-36" />
          )}
          <div className="w-44 border-t border-neutral-400 pt-1">
            <p className="text-xs font-semibold">{drName(name)}</p>
            <p className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700"><ShieldCheck className="h-3 w-3" aria-hidden /> Digitally signed</p>
          </div>
        </div>
      </footer>

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

    </div>
  );
}
