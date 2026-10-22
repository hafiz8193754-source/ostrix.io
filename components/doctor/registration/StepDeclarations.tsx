"use client";

import { Loader2 } from "lucide-react";
import type { RegistrationAnswers } from "./types";

interface StepDeclarationsProps {
  values: RegistrationAnswers;
  onChange: (patch: Partial<RegistrationAnswers>) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

const DECLARATIONS: { key: keyof RegistrationAnswers; text: string }[] = [
  {
    key: "declaration_pmdc_valid",
    text: "I confirm I am currently registered with PMDC and my registration is valid and not suspended.",
  },
  {
    key: "declaration_ai_responsibility",
    text: "I understand Ostrix provides AI-assisted drafts only, and that I am solely responsible for reviewing, editing, and approving every clinical output before it reaches a patient.",
  },
  { key: "declaration_terms", text: "I agree to the Terms of Service and Privacy Policy." },
];

export function StepDeclarations({ values, onChange, onBack, onSubmit, submitting, error }: StepDeclarationsProps) {
  const allChecked = DECLARATIONS.every((d) => values[d.key] === true);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-text-primary">Declarations &amp; Submit</h2>
      </div>

      <div className="flex flex-col gap-3">
        {DECLARATIONS.map((d) => (
          <label key={d.key} className="flex items-start gap-2.5 rounded-lg border border-border bg-bg-elevated p-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={values[d.key] === true}
              onChange={(e) => onChange({ [d.key]: e.target.checked } as Partial<RegistrationAnswers>)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            {d.text}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!allChecked || submitting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit for Verification
        </button>
      </div>
    </div>
  );
}
