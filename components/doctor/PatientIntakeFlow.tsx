"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Brain, Utensils, Sparkles, Bone, Baby, Flower2, Eye, Smile, HeartPulse, type LucideIcon } from "lucide-react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { VoiceRecordButton } from "@/components/shared/VoiceRecordButton";
import { cn } from "@/lib/utils";

export interface IntakeSummary {
  whatsWrong: string;
  duration: string;
  severity: "mild" | "moderate" | "severe" | "";
  hasFever: boolean | null;
  existingConditions: string;
  currentMedicines: string;
  allergies: string;
  age: string;
  isPregnant: boolean | null;
}

export function buildIntakeSummaryText(intake: IntakeSummary): string {
  return [
    intake.whatsWrong,
    intake.duration ? `Duration: ${intake.duration}.` : "",
    intake.severity ? `Severity: ${intake.severity}.` : "",
    intake.hasFever !== null ? `Fever: ${intake.hasFever ? "yes" : "no"}.` : "",
    intake.existingConditions ? `Existing conditions: ${intake.existingConditions}.` : "",
    intake.currentMedicines ? `Current medicines: ${intake.currentMedicines}.` : "",
    intake.allergies ? `Allergies: ${intake.allergies}.` : "",
    intake.age ? `Age: ${intake.age}.` : "",
    intake.isPregnant !== null ? `Pregnant: ${intake.isPregnant ? "yes" : "no"}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface Category {
  label: string;
  whatsWrong: string;
  icon: LucideIcon;
}

const CATEGORIES: Category[] = [
  { label: "Headache & Migraine", whatsWrong: "Bad headache / migraine", icon: Brain },
  { label: "Stomach Problems", whatsWrong: "Stomach pain and digestion issues", icon: Utensils },
  { label: "Skin Issues", whatsWrong: "Skin rash or irritation", icon: Sparkles },
  { label: "Bone & Joint Pain", whatsWrong: "Bone or joint pain", icon: Bone },
  { label: "Children's Health", whatsWrong: "Child is unwell", icon: Baby },
  { label: "Women's Health", whatsWrong: "Women's health concern", icon: Flower2 },
  { label: "Eye Problems", whatsWrong: "Eye problem", icon: Eye },
  { label: "Dental Issues", whatsWrong: "Dental problem", icon: Smile },
  { label: "Mental Health", whatsWrong: "Stress, anxiety, or low mood", icon: HeartPulse },
];

// The question bubble. Fixed-size avatar column and a min-w-0 text column so
// every question lines up the same way regardless of length or viewport.
function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center">
        <OstrixLogo size="xs" />
      </div>
      <div
        data-testid="intake-question"
        className="min-w-0 max-w-[560px] flex-1 break-words rounded-[18px] rounded-tl-sm border border-border bg-bg-surface px-4 py-3 text-[15px] leading-[1.6] text-text-primary sm:px-5 sm:py-3.5"
      >
        {children}
      </div>
    </div>
  );
}

function StepShell({ children, stepKey }: { children: React.ReactNode; stepKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
  return (
    <motion.div
      key={stepKey}
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex w-full max-w-[600px] flex-col gap-3"
    >
      {children}
    </motion.div>
  );
}

// Text answer row: input, mic and Send live inside one rounded field so the
// Send button never gets pushed to the screen edge. 44px tap targets, and the
// row respects the iOS safe area at the bottom.
function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  accessToken,
  allowEmpty = false,
  inputMode,
  voice = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  accessToken: string;
  allowEmpty?: boolean;
  inputMode?: "numeric" | "text";
  voice?: boolean;
}) {
  const disabled = !allowEmpty && !value.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
      }}
      className="flex w-full items-center gap-1.5 rounded-2xl border border-border bg-bg-elevated p-1.5 pl-4 focus-within:border-accent"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-muted"
      />
      {voice && <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => onChange(value ? `${value} ${t}` : t)} />}
      <button
        type="submit"
        disabled={disabled}
        aria-label="Send"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUp className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
}

const choiceClass =
  "min-h-[44px] flex-1 rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:bg-accent-glow";

interface PatientIntakeFlowProps {
  accessToken: string;
  onComplete: (summaryText: string, structured: IntakeSummary) => void;
}

const INITIAL: IntakeSummary = {
  whatsWrong: "",
  duration: "",
  severity: "",
  hasFever: null,
  existingConditions: "",
  currentMedicines: "",
  allergies: "",
  age: "",
  isPregnant: null,
};

// One message, then straight to a doctor. No follow-up / history questions:
// the patient types (or picks) their problem and is routed immediately. The
// doctor takes history during the consultation.
export function PatientIntakeFlow({ accessToken, onComplete }: PatientIntakeFlowProps) {
  const [draft, setDraft] = useState("");

  function finish(text: string) {
    const whatsWrong = text.trim();
    if (!whatsWrong) return;
    const final = { ...INITIAL, whatsWrong };
    onComplete(buildIntakeSummaryText(final), final);
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-4">
      <StepShell stepKey={1}>
        <Bubble>Tell us your problem in one line. We&apos;ll connect you to the right doctor right away.</Bubble>
        <Composer value={draft} onChange={setDraft} onSubmit={() => finish(draft)} placeholder="e.g. pait mein dard, skin rash, bukhar aur khansi" accessToken={accessToken} />
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => finish(c.whatsWrong)}
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:border-accent hover:bg-accent-glow"
            >
              <c.icon className="h-4 w-4 shrink-0 text-accent" aria-hidden /> {c.label}
            </button>
          ))}
        </div>
      </StepShell>
    </div>
  );
}
