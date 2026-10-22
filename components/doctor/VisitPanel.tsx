"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

interface VisitPanelProps {
  consultationId: string;
  accessToken: string;
  patientLabel: string;
  symptoms: string | null;
  onDrafted: (prescriptionId: string | null) => void;
  onClose: () => void;
}

// Doctor writes visit notes, ends the visit, and gets an AI prescription draft
// that then appears under "Prescriptions to review" for edit + signature.
export function VisitPanel({ consultationId, accessToken, patientLabel, symptoms, onDrafted, onClose }: VisitPanelProps) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "ending" | "drafting">("");
  const [error, setError] = useState("");
  const [startedAt] = useState(() => Date.now());

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  async function finish() {
    if (!notes.trim()) {
      setError("Write your clinical notes first (findings, assessment, plan).");
      return;
    }
    setError("");
    try {
      setBusy("ending");
      await post("/api/doctor/call/end", {
        consultation_id: consultationId,
        duration_seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
        doctor_notes: notes,
      });
      setBusy("drafting");
      const draft = await post("/api/doctor/prescription/draft", { consultation_id: consultationId });
      onDrafted(draft.prescription_id || null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div data-testid="visit-panel" className="mt-3 flex flex-col gap-3 rounded-xl border border-accent/40 bg-bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">Visit in progress · {patientLabel}</p>
        <button onClick={onClose} className="text-xs text-text-muted hover:text-text-primary">
          Close
        </button>
      </div>
      {symptoms && (
        <p className="rounded-lg bg-bg-elevated px-3 py-2 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">Patient reported: </span>
          {symptoms}
        </p>
      )}
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        Clinical notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="History, examination findings, assessment, plan…"
          className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={finish}
        disabled={!!busy}
        className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy === "ending" ? "Saving notes…" : busy === "drafting" ? "Drafting prescription (up to a minute)…" : "End visit & draft prescription"}
      </button>
      <p className="text-[11px] text-text-muted">The AI draft is only a starting point. You review, edit and sign it before the patient sees it.</p>
    </div>
  );
}
