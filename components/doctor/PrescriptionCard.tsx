"use client";

import { useState } from "react";
import { Download, ShieldCheck, Loader2 } from "lucide-react";
import type { Doctor, Patient, Prescription } from "@/types";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";

interface PrescriptionCardProps {
  prescription: Prescription;
  doctor: Doctor;
  patient: Patient;
  accessToken: string;
}

export function PrescriptionCard({ prescription, doctor, patient, accessToken }: PrescriptionCardProps) {
  const [downloading, setDownloading] = useState(false);
  const rx = prescription.final_prescription;
  if (!rx || prescription.status !== "approved") return null;

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/doctor/prescription/pdf?id=${prescription.id}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Could not download the PDF.");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `prescription-${prescription.id.slice(0, 8)}.pdf`;
      a.click();
    } catch {
      // best-effort — button stays enabled for retry
    }
    setDownloading(false);
  }

  return (
    <div className="flex max-w-[600px] flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Prescription</p>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
          <ShieldCheck className="h-3 w-3" /> Approved
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-text-primary">Dr. {doctor.full_name} · PMDC #{doctor.pmdc_number}</p>
        {doctor.clinic_name && <p className="text-xs text-text-muted">{doctor.clinic_name}</p>}
        <p className="text-xs text-text-muted">{new Date(prescription.doctor_signed_at || prescription.created_at).toLocaleDateString()}</p>
      </div>

      <p className="text-sm text-text-secondary">
        Patient: {patient.full_name}, {patient.gender || "—"}, {patient.age ?? "—"} years
      </p>
      <p className="text-sm font-medium text-text-primary">Diagnosis: {rx.diagnosis}</p>

      <div className="rounded-xl border border-border bg-bg-elevated p-3.5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Rx</p>
        <ul className="flex flex-col gap-2">
          {rx.medications.map((m, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium text-text-primary">{i + 1}. {m.name}</p>
              <p className="text-xs text-text-muted">{m.dosage} · {m.frequency} · {m.duration}</p>
            </li>
          ))}
        </ul>
      </div>

      {rx.lab_tests.length > 0 && (
        <p className="text-sm text-text-secondary">Lab Tests: {rx.lab_tests.map((t) => t.name).join(", ")}</p>
      )}

      {rx.advice.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Advice</p>
          <ul className="flex flex-col gap-0.5 text-sm text-text-secondary">
            {rx.advice.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </div>
      )}

      {rx.follow_up && <p className="text-sm text-text-secondary">Follow-up: {rx.follow_up}</p>}
      {rx.emergency_instructions && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">Go to ER if: {rx.emergency_instructions}</p>
      )}

      <button
        onClick={downloadPdf}
        disabled={downloading}
        className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-accent px-4 py-2 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-60"
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download PDF
      </button>

      <div className="border-t border-border pt-2.5 text-[11px] text-text-muted">
        <p>Digitally signed by Dr. {doctor.full_name} · PMDC #{doctor.pmdc_number} · Verified at pmdc.org.pk</p>
        <p>AI-assisted draft reviewed and approved by doctor.</p>
        <p className="mt-1">{CLINICAL_DISCLAIMER}</p>
      </div>
    </div>
  );
}
