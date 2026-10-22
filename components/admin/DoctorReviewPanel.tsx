"use client";

import { useState } from "react";
import { ExternalLink, CheckCircle2, HelpCircle, XCircle, Ban, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { VerificationChecklist } from "./VerificationChecklist";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Doctor } from "@/types";

interface DoctorReviewPanelProps {
  doctor: Doctor;
  accessToken: string;
  onReviewed: (doctor: Doctor) => void;
}

const DOCS: { key: "pmdc_certificate_url" | "degree_certificate_url" | "cnic_front_url" | "profile_photo_url"; label: string }[] = [
  { key: "pmdc_certificate_url", label: "PMDC certificate" },
  { key: "degree_certificate_url", label: "Degree certificate" },
  { key: "cnic_front_url", label: "CNIC front" },
  { key: "profile_photo_url", label: "Profile photo" },
];

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-28 shrink-0 text-text-muted">{label}</span>
      <span className="flex-1 text-text-primary">{value || "—"}</span>
    </div>
  );
}

type PendingAction = "request_info" | "reject" | "suspend" | null;

export function DoctorReviewPanel({ doctor, accessToken, onReviewed }: DoctorReviewPanelProps) {
  const [checked, setChecked] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  function toggleChecklist(key: string) {
    setChecked((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  }

  async function openDocument(path: string) {
    setPreviewLoading(path);
    const { data } = await supabase.storage.from("doctor-documents").createSignedUrl(path, 300);
    setPreviewLoading(null);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
    else setError("Could not load that document.");
  }

  async function act(action: "approve" | "request_info" | "reject" | "suspend") {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "approve") body.checklist = checked;
      if (action === "request_info") body.note = note.trim();
      if (action === "reject" || action === "suspend") body.reason = note.trim();

      const res = await fetch(`/api/admin/doctors/${doctor.id}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      setNote("");
      setPendingAction(null);
      onReviewed(data.doctor);
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  }

  const allChecked = checked.length >= 7;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left — submitted data + documents */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Submitted data</p>
          <SummaryRow label="Full name" value={doctor.full_name} />
          <SummaryRow label="CNIC" value={doctor.cnic || ""} />
          <SummaryRow label="Email" value={doctor.email || ""} />
          <SummaryRow label="Phone" value={doctor.phone} />
          <SummaryRow label="WhatsApp" value={doctor.whatsapp || ""} />
          <SummaryRow label="PMDC number" value={doctor.pmdc_number} />
          <SummaryRow label="Registration type" value={doctor.pmdc_registration_type || ""} />
          <SummaryRow label="PMDC expiry" value={doctor.pmdc_expiry_date || ""} />
          <SummaryRow label="Specialization" value={doctor.specialization.replace(/_/g, " ")} />
          <SummaryRow label="Sub-specialization" value={doctor.sub_specialization || ""} />
          <SummaryRow label="Qualifications" value={doctor.qualifications} />
          <SummaryRow label="Graduated" value={String(doctor.year_of_graduation || "")} />
          <SummaryRow label="Experience" value={`${doctor.experience_years} years`} />
          <SummaryRow label="Languages" value={doctor.languages.join(", ")} />
          <SummaryRow label="Clinic" value={doctor.clinic_name || ""} />
          <SummaryRow label="Address" value={doctor.clinic_address || ""} />
          <SummaryRow label="City" value={doctor.city} />
          <SummaryRow label="Fee" value={`PKR ${doctor.consultation_fee_pkr}`} />
          <SummaryRow label="Bio" value={doctor.bio || ""} />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Documents</p>
          {DOCS.map((doc) => {
            const path = doctor[doc.key] as string | null;
            return (
              <button
                key={doc.key}
                disabled={!path || previewLoading === path}
                onClick={() => path && openDocument(path)}
                className="flex items-center justify-between rounded-lg border border-border bg-bg-surface px-3 py-2 text-xs text-text-secondary hover:border-accent hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {doc.label}
                {previewLoading === path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — checklist + actions */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-bg-surface p-4">
          <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-text-muted">
            Verification checklist
            <a
              href="https://www.pmdc.pk/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] normal-case text-accent hover:underline"
            >
              Open pmdc.org.pk <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <VerificationChecklist checked={checked} onToggle={toggleChecklist} />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {pendingAction ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-surface p-4">
            <p className="text-xs font-medium text-text-primary">
              {pendingAction === "request_info" && "What's needed from the doctor?"}
              {pendingAction === "reject" && "Reason for rejection"}
              {pendingAction === "suspend" && "Reason for suspension"}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs text-text-primary outline-none focus-visible:border-accent"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => act(pendingAction)}
                disabled={submitting || !note.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm
              </button>
              <button onClick={() => setPendingAction(null)} className="text-xs text-text-secondary hover:text-text-primary">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => act("approve")}
              disabled={!allChecked || submitting}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
            </button>
            <button
              onClick={() => setPendingAction("request_info")}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Request more info
            </button>
            <button
              onClick={() => setPendingAction("reject")}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-500/5"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
            {doctor.registration_status === "verified" && (
              <button
                onClick={() => setPendingAction("suspend")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-500/5"
              >
                <Ban className="h-3.5 w-3.5" /> Suspend
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Document preview</DialogTitle>
          {previewUrl &&
            (previewUrl.includes(".pdf") ? (
              <iframe src={previewUrl} className="h-[70vh] w-full rounded-lg border border-border" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Document" className="max-h-[70vh] w-full rounded-lg object-contain" />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
