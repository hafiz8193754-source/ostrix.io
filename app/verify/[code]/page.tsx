"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { OstrixLogo } from "@/components/brand/OstrixLogo";

type Result = {
  valid: boolean;
  status?: string;
  integrity?: string;
  reason?: string;
  superseded_by_code?: string | null;
  version?: number;
  signed_at?: string | null;
  doctor?: { name: string | null; specialty: string | null; pmdc_number: string | null };
  content_hash?: string | null;
  medicines?: { name: string; dosage: string; frequency: string; duration: string }[];
};

const fmt = (c: string) => (c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);

// Public page (no login) for pharmacies/anyone holding a printed prescription.
// Shows who signed it and whether the content is intact — never the patient.
export default function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const [r, setR] = useState<Result | null>(null);
  useEffect(() => {
    fetch(`/api/verify/${encodeURIComponent(code)}`)
      .then((x) => x.json())
      .then(setR)
      .catch(() => setR({ valid: false, reason: "error" }));
  }, [code]);

  const doctorName = r?.doctor?.name ? `Dr. ${r.doctor.name.replace(/^\s*dr\.?\s+/i, "")}` : "—";
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-5 px-4 py-8">
      <OstrixLogo size="sm" withWordmark />
      <h1 className="font-display text-2xl font-bold text-text-primary">Prescription verification</h1>
      <p className="text-sm text-text-secondary">Code: <span className="font-mono">{fmt(String(code).toUpperCase())}</span></p>
      {!r ? (
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      ) : r.reason === "not_found" || r.reason === "invalid_code" ? (
        <div data-testid="verify-result" data-valid="false" className="flex items-start gap-2 rounded-xl border-2 border-red-500 bg-red-500/10 p-4 text-sm text-red-700">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" /> No Ostrix prescription matches this code. Treat the document as NOT verified.
        </div>
      ) : (
        <>
          {r.valid ? (
            <div data-testid="verify-result" data-valid="true" className="flex items-start gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 p-4 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> Authentic. This prescription was digitally signed on Ostrix and its content has not been changed since signing.
            </div>
          ) : r.status === "superseded" ? (
            <div data-testid="verify-result" data-valid="false" className="flex items-start gap-2 rounded-xl border-2 border-amber-500 bg-amber-500/10 p-4 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                This prescription was genuinely signed but has been <b>replaced by a newer version</b>. Do not dispense from this copy.
                {r.superseded_by_code && <> Newer version: <a className="underline" href={`/verify/${r.superseded_by_code}`}>{fmt(r.superseded_by_code)}</a></>}
              </span>
            </div>
          ) : (
            <div data-testid="verify-result" data-valid="false" className="flex items-start gap-2 rounded-xl border-2 border-red-500 bg-red-500/10 p-4 text-sm text-red-700">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" /> Could not confirm this prescription ({r.integrity || r.status}).
            </div>
          )}
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 rounded-xl border border-border bg-bg-surface p-4 text-sm">
            <dt className="text-text-muted">Signed by</dt><dd className="text-text-primary">{doctorName}</dd>
            <dt className="text-text-muted">Specialty</dt><dd className="text-text-primary">{r.doctor?.specialty || "—"}</dd>
            <dt className="text-text-muted">PMDC no.</dt><dd className="text-text-primary">{r.doctor?.pmdc_number || "not on file"}</dd>
            <dt className="text-text-muted">Signed on</dt><dd className="text-text-primary">{r.signed_at ? new Date(r.signed_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" }) + " (PKT)" : "—"}</dd>
            <dt className="text-text-muted">Version</dt><dd className="text-text-primary">{r.version}</dd>
            <dt className="text-text-muted">SHA-256</dt><dd className="break-all font-mono text-[11px] text-text-secondary">{r.content_hash}</dd>
          </dl>
          {r.medicines && r.medicines.length > 0 && (
            <div className="rounded-xl border border-border bg-bg-surface p-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Medicines on this prescription</p>
              <ul className="list-disc pl-5 text-text-primary">
                {r.medicines.map((m, i) => <li key={i}>{m.name} — {m.dosage}, {m.frequency}, {m.duration}</li>)}
              </ul>
            </div>
          )}
          <p className="text-xs text-text-muted">For privacy, patient details are never shown on this page. Pharmacists: match the medicines and doctor above with the paper/PDF you were given.</p>
        </>
      )}
    </div>
  );
}
