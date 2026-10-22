"use client";

import { Stethoscope, AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import type { Urgency } from "@/types";

interface SpecialistCardProps {
  specializationDisplay: string;
  specializationUrdu: string;
  urgency: Urgency;
  reasoning: string;
  redFlags: string[];
  questionsToAskDoctor: string[];
}

const URGENCY_META: Record<Urgency, { label: string; dot: string }> = {
  routine: { label: "Can wait a few days", dot: "bg-emerald-500" },
  soon: { label: "Within 24-48 hours", dot: "bg-yellow-500" },
  urgent: { label: "See a doctor today", dot: "bg-orange-500" },
  emergency: { label: "Immediately", dot: "bg-red-500" },
};

export function SpecialistCard({ specializationDisplay, specializationUrdu, urgency, reasoning, redFlags, questionsToAskDoctor }: SpecialistCardProps) {
  const meta = URGENCY_META[urgency];
  return (
    <div className="flex max-w-[560px] flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Suggested Specialist</p>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-glow text-accent">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-semibold text-text-primary">{specializationDisplay}</p>
          {specializationUrdu && <p className="text-sm text-text-muted">{specializationUrdu}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        <span className="text-text-secondary">Urgency: {meta.label}</span>
      </div>

      <p className="text-sm leading-relaxed text-text-secondary">{reasoning}</p>

      {redFlags.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Go to the ER immediately if you experience:
          </p>
          <ul className="flex flex-col gap-0.5 text-sm text-text-secondary">
            {redFlags.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}

      {questionsToAskDoctor.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-muted">
            <HelpCircle className="h-3.5 w-3.5" /> Questions to ask your doctor
          </p>
          <ul className="flex flex-col gap-0.5 text-sm text-text-secondary">
            {questionsToAskDoctor.map((q, i) => (
              <li key={i}>• {q}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="rounded-lg bg-bg-elevated px-3 py-2 text-xs text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
