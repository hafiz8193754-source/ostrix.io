"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SignaturePad, type SignaturePadHandle } from "@/components/doctor/SignaturePad";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import type { Appointment, Consultation, Doctor, Medication, Prescription, PrescriptionData } from "@/types";

interface PrescriptionReviewPanelProps {
  prescription: Prescription;
  doctor: Doctor;
  accessToken: string;
  onReviewed: (prescription: Prescription) => void;
  onSignatureSaved?: (signatureUrl: string) => void;
}

function emptyMed(): Medication {
  return { name: "", dosage: "", frequency: "", duration: "", route: "oral", instructions: "", quantity: 1, warnings: [] };
}

function CollapsiblePanel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-bg-elevated">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} {title}
      </button>
      {open && <div className="border-t border-border px-4 py-3 text-xs text-text-secondary">{children}</div>}
    </div>
  );
}

// Converts a fetched image Blob to a base64 data URL, same shape the
// SignaturePad's own canvas.toDataURL() already produces, so "use my saved
// signature" and "draw a new one" both feed the review route identically.
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function PrescriptionReviewPanel({ prescription, doctor, accessToken, onReviewed, onSignatureSaved }: PrescriptionReviewPanelProps) {
  const source = prescription.doctor_edited_prescription || prescription.ai_generated_prescription;
  const [draft, setDraft] = useState<PrescriptionData>(source);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responsibilityChecked, setResponsibilityChecked] = useState(false);
  const [useSavedSignature, setUseSavedSignature] = useState(!!doctor.signature_url);
  const [savedSignaturePreview, setSavedSignaturePreview] = useState<string | null>(null);
  const [saveSignatureForNextTime, setSaveSignatureForNextTime] = useState(!doctor.signature_url);
  const sigRef = useRef<SignaturePadHandle>(null);

  const [context, setContext] = useState<{ consultation: Consultation | null; appointment: Appointment | null } | null>(null);

  useEffect(() => {
    fetch(`/api/doctor/prescription/${prescription.id}/context`, { headers: { authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => setContext({ consultation: d.consultation || null, appointment: d.appointment || null }))
      .catch(() => setContext({ consultation: null, appointment: null }));
  }, [prescription.id, accessToken]);

  useEffect(() => {
    if (!doctor.signature_url || !useSavedSignature) {
      setSavedSignaturePreview(null);
      return;
    }
    supabase.storage
      .from("signatures")
      .createSignedUrl(doctor.signature_url, 300)
      .then(({ data }) => setSavedSignaturePreview(data?.signedUrl || null));
  }, [doctor.signature_url, useSavedSignature]);

  async function getSignatureDataUrl(): Promise<string | null> {
    if (useSavedSignature && doctor.signature_url) {
      const { data } = await supabase.storage.from("signatures").createSignedUrl(doctor.signature_url, 60);
      if (!data?.signedUrl) return null;
      const blob = await (await fetch(data.signedUrl)).blob();
      return blobToDataUrl(blob);
    }
    return sigRef.current?.getDataUrl() || null;
  }

  async function maybeSaveSignature(dataUrl: string) {
    if (useSavedSignature || !saveSignatureForNextTime) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${doctor.user_id}/signature.png`;
      const { error: uploadError } = await supabase.storage.from("signatures").upload(path, blob, { upsert: true, contentType: "image/png" });
      if (uploadError) return;
      const res = await fetch("/api/doctor/signature", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ signature_path: path }),
      });
      const data = await res.json();
      if (res.ok) onSignatureSaved?.(data.signature_url);
    } catch {
      // signature reuse is a convenience — a failed save doesn't block approval
    }
  }

  async function review(action: "approve" | "reject") {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { prescription_id: prescription.id, action };
      if (action === "approve") {
        if (!responsibilityChecked) {
          setError("Tick the responsibility checkbox before approving.");
          setSubmitting(false);
          return;
        }
        const signatureData = await getSignatureDataUrl();
        if (!signatureData) {
          setError("Please sign before approving.");
          setSubmitting(false);
          return;
        }
        body.edited_prescription = { ...draft, advice: draft.advice.map((a) => a.trim()).filter(Boolean), medications: draft.medications.filter((m) => m.name.trim()) };
        body.signature_data = signatureData;
        await maybeSaveSignature(signatureData);
      } else {
        if (!rejectReason.trim()) {
          setError("A rejection reason is required.");
          setSubmitting(false);
          return;
        }
        body.rejection_reason = rejectReason;
      }
      const res = await fetch("/api/doctor/prescription/review", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit review.");
      onReviewed(data.prescription);
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  }

  function updateMed(i: number, patch: Partial<Medication>) {
    setDraft((d) => ({ ...d, medications: d.medications.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }));
  }

  const isRevision = (prescription.version ?? 1) > 1;
  return (
    <div data-testid="rx-review" className="flex flex-col gap-3">
      <div data-testid="ai-draft-banner" className="flex items-start gap-2 rounded-xl border-2 border-amber-500 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>AI draft – needs doctor review.</b> Grok generated this from the visit. Check and edit every field; nothing reaches the patient until you approve &amp; sign.
          {isRevision && <> This is <b>version {prescription.version}</b>; signing it replaces the earlier signed version.</>}
        </span>
      </div>
      {context?.appointment?.ai_symptom_analysis && Object.keys(context.appointment.ai_symptom_analysis).length > 0 && (
        <CollapsiblePanel title="Patient intake">
          <pre className="whitespace-pre-wrap break-words font-sans">{JSON.stringify(context.appointment.ai_symptom_analysis, null, 2)}</pre>
        </CollapsiblePanel>
      )}
      {context?.consultation?.ai_transcript && (
        <CollapsiblePanel title="Call transcript">
          <p className="whitespace-pre-wrap">{context.consultation.ai_transcript}</p>
        </CollapsiblePanel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Original AI draft (read-only)</p>
          <p className="text-sm text-text-primary">Diagnosis: {source.diagnosis}</p>
          <ul className="flex flex-col gap-1 text-sm text-text-secondary">
            {source.medications.map((m, i) => (
              <li key={i}>
                {i + 1}. {m.name} — {m.dosage}, {m.frequency}, {m.duration}
              </li>
            ))}
          </ul>
          {prescription.drug_interactions.length > 0 && (
            <div className="mt-1 flex items-start gap-1.5 rounded-lg bg-yellow-500/10 px-2.5 py-2 text-xs text-yellow-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{prescription.drug_interactions.join("; ")}</span>
            </div>
          )}
          {source.contraindication_flags.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-2 text-xs text-red-600">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{source.contraindication_flags.join("; ")}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Doctor review — edit before signing</p>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Diagnosis
            <input
              value={draft.diagnosis}
              onChange={(e) => setDraft((d) => ({ ...d, diagnosis: e.target.value }))}
              className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-sm text-text-primary outline-none focus-visible:border-accent"
            />
          </label>

          <div className="flex flex-col gap-2">
            {draft.medications.map((m, i) => (
              <div key={i} className="grid grid-cols-2 gap-1.5 rounded-lg border border-border p-2">
                <input data-testid="med-name" value={m.name} onChange={(e) => updateMed(i, { name: e.target.value })} placeholder="Name" className="col-span-2 h-8 rounded border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent" />
                <input data-testid="med-dosage" value={m.dosage} onChange={(e) => updateMed(i, { dosage: e.target.value })} placeholder="Dosage" className="h-8 rounded border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent" />
                <input value={m.frequency} onChange={(e) => updateMed(i, { frequency: e.target.value })} placeholder="Frequency" className="h-8 rounded border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent" />
                <input value={m.duration} onChange={(e) => updateMed(i, { duration: e.target.value })} placeholder="Duration" className="h-8 rounded border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent" />
                <input value={m.instructions} onChange={(e) => updateMed(i, { instructions: e.target.value })} placeholder="Instructions" className="h-8 rounded border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent" />
                <button type="button" onClick={() => setDraft((d) => ({ ...d, medications: d.medications.filter((_, idx) => idx !== i) }))} className="col-span-2 justify-self-end text-[11px] text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, medications: [...d.medications, emptyMed()] }))}
              className="self-start text-xs font-medium text-accent hover:underline"
            >
              + Add medication
            </button>
          </div>

          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Treatment plan
            <textarea data-testid="rx-plan-input" rows={3} value={draft.treatment_plan || ""} onChange={(e) => setDraft((d) => ({ ...d, treatment_plan: e.target.value }))} className="rounded-md border border-border bg-bg-elevated px-2.5 py-2 text-sm text-text-primary outline-none focus-visible:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Advice / instructions (one per line)
            <textarea rows={3} value={draft.advice.join("\n")} onChange={(e) => setDraft((d) => ({ ...d, advice: e.target.value.split("\n") }))} className="rounded-md border border-border bg-bg-elevated px-2.5 py-2 text-sm text-text-primary outline-none focus-visible:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Follow-up
            <input data-testid="rx-followup-input" value={draft.follow_up} onChange={(e) => setDraft((d) => ({ ...d, follow_up: e.target.value }))} className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-sm text-text-primary outline-none focus-visible:border-accent" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Go to emergency if…
            <input value={draft.emergency_instructions} onChange={(e) => setDraft((d) => ({ ...d, emergency_instructions: e.target.value }))} className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-sm text-text-primary outline-none focus-visible:border-accent" />
          </label>

          <div>
            <p className="mb-1 text-xs text-text-secondary">Signature</p>
            {doctor.signature_url && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={useSavedSignature} onChange={() => setUseSavedSignature(true)} className="accent-accent" /> Use saved signature
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={!useSavedSignature} onChange={() => setUseSavedSignature(false)} className="accent-accent" /> Draw a new one
                </label>
              </div>
            )}
            {useSavedSignature && doctor.signature_url ? (
              savedSignaturePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={savedSignaturePreview} alt="Saved signature" className="h-[120px] w-full max-w-[320px] rounded-lg border border-border bg-white object-contain" />
              ) : (
                <div className="flex h-[120px] w-full max-w-[320px] items-center justify-center rounded-lg border border-border bg-white text-xs text-text-muted">Loading…</div>
              )
            ) : (
              <>
                <SignaturePad ref={sigRef} width={320} height={120} />
                <label className="mt-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
                  <input type="checkbox" checked={saveSignatureForNextTime} onChange={(e) => setSaveSignatureForNextTime(e.target.checked)} className="accent-accent" />
                  Save this signature for next time
                </label>
              </>
            )}
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-elevated p-2.5 text-xs text-text-primary">
            <input data-testid="rx-responsibility" type="checkbox" checked={responsibilityChecked} onChange={(e) => setResponsibilityChecked(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent" />
            I have reviewed this prescription and take responsibility for it.
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {rejecting ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejecting this draft…"
                rows={2}
                className="resize-none rounded-md border border-border bg-bg-elevated px-2.5 py-2 text-xs text-text-primary outline-none focus-visible:border-accent"
              />
              <div className="flex items-center gap-2">
                <button onClick={() => review("reject")} disabled={submitting} className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm Reject
                </button>
                <button onClick={() => setRejecting(false)} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                data-testid="rx-approve"
                onClick={() => review("approve")}
                disabled={submitting || !responsibilityChecked}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve & Sign
              </button>
              <button
                onClick={() => setRejecting(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2.5 text-xs font-medium text-red-600 hover:bg-red-500/5"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
