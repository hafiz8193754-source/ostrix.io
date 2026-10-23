"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, ChevronLeft, Brain, Utensils, Sparkles, Bone, Baby, Flower2, Eye, Smile, HeartPulse, type LucideIcon } from "lucide-react";

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
    `Duration: ${intake.duration || "not specified"}.`,
    intake.severity ? `Severity: ${intake.severity}.` : "",
    intake.hasFever !== null ? `Fever: ${intake.hasFever ? "yes" : "no"}.` : "",
    `Existing conditions: ${intake.existingConditions || "none reported"}.`,
    `Current medicines: ${intake.currentMedicines || "none reported"}.`,
    `Allergies: ${intake.allergies || "none reported"}.`,
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

function SkipButton({ onClick, label = "None" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[44px] self-start rounded-lg px-2 text-sm font-medium text-text-secondary hover:text-accent">
      {label}
    </button>
  );
}

const TOTAL_STEPS = 9;

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

// One question at a time, per the spec's explicit instruction — never all at
// once. Same bubble-step UX as components/WebsiteQuestionnaire.tsx. Every
// free-text step gets a press-and-hold mic button (VoiceRecordButton) that
// fills the field for the patient to review/edit, never auto-submits.
export function PatientIntakeFlow({ accessToken, onComplete }: PatientIntakeFlowProps) {
  const [step, setStep] = useState(1);
  const [intake, setIntake] = useState<IntakeSummary>(INITIAL);

  const [whatsWrongDraft, setWhatsWrongDraft] = useState("");
  const [durationDraft, setDurationDraft] = useState("");
  const [conditionsDraft, setConditionsDraft] = useState("");
  const [medicinesDraft, setMedicinesDraft] = useState("");
  const [allergiesDraft, setAllergiesDraft] = useState("");
  const [ageDraft, setAgeDraft] = useState("");

  function goTo(n: number) {
    setStep(n);
  }

  function selectCategory(cat: Category) {
    setIntake((i) => ({ ...i, whatsWrong: cat.whatsWrong }));
    goTo(2);
  }

  function submitWhatsWrong() {
    if (!whatsWrongDraft.trim()) return;
    setIntake((i) => ({ ...i, whatsWrong: whatsWrongDraft.trim() }));
    goTo(2);
  }

  function submitDuration() {
    if (!durationDraft.trim()) return;
    setIntake((i) => ({ ...i, duration: durationDraft.trim() }));
    goTo(3);
  }

  function selectSeverity(severity: IntakeSummary["severity"]) {
    setIntake((i) => ({ ...i, severity }));
    goTo(4);
  }

  function selectFever(hasFever: boolean) {
    setIntake((i) => ({ ...i, hasFever }));
    goTo(5);
  }

  function submitConditions(skip = false) {
    setIntake((i) => ({ ...i, existingConditions: skip ? "" : conditionsDraft.trim() }));
    goTo(6);
  }

  function submitMedicines(skip = false) {
    setIntake((i) => ({ ...i, currentMedicines: skip ? "" : medicinesDraft.trim() }));
    goTo(7);
  }

  function submitAllergies(skip = false) {
    setIntake((i) => ({ ...i, allergies: skip ? "" : allergiesDraft.trim() }));
    goTo(8);
  }

  function submitAge() {
    if (!ageDraft.trim()) return;
    setIntake((i) => ({ ...i, age: ageDraft.trim() }));
    goTo(9);
  }

  function selectPregnant(isPregnant: boolean | null) {
    const final = { ...intake, isPregnant };
    setIntake(final);
    onComplete(buildIntakeSummaryText(final), final);
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-4">
      {/* One question at a time: only the current step is rendered. */}
      <div className="flex items-center justify-between text-xs text-text-muted" aria-live="polite">
        <span data-testid="intake-progress">Question {step} of {TOTAL_STEPS}</span>
        {step > 1 && (
          <button type="button" onClick={() => goTo(step - 1)} className="flex min-h-[44px] items-center gap-1 px-1 font-medium text-text-secondary hover:text-accent">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back
          </button>
        )}
      </div>

      {step === 1 && (
        <StepShell stepKey={1}>
          <Bubble>What&apos;s wrong? Pick a category, or describe it yourself.</Bubble>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => selectCategory(c)}
                className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:border-accent hover:bg-accent-glow"
              >
                <c.icon className="h-4 w-4 shrink-0 text-accent" aria-hidden /> {c.label}
              </button>
            ))}
          </div>
          <Composer value={whatsWrongDraft} onChange={setWhatsWrongDraft} onSubmit={submitWhatsWrong} placeholder="Or describe it in your own words…" accessToken={accessToken} />
        </StepShell>
      )}

      {step === 2 && (
        <StepShell stepKey={2}>
          <Bubble>How long has this been going on?</Bubble>
          <Composer value={durationDraft} onChange={setDurationDraft} onSubmit={submitDuration} placeholder="e.g. 3 days, since this morning" accessToken={accessToken} />
        </StepShell>
      )}

      {step === 3 && (
        <StepShell stepKey={3}>
          <Bubble>How severe would you say it is?</Bubble>
          <div className="flex w-full gap-2">
            {(["mild", "moderate", "severe"] as const).map((sv) => (
              <button key={sv} type="button" onClick={() => selectSeverity(sv)} className={cn(choiceClass, "capitalize")}>
                {sv}
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell stepKey={4}>
          <Bubble>Any fever?</Bubble>
          <div className="flex w-full gap-2">
            <button type="button" onClick={() => selectFever(true)} className={choiceClass}>Yes</button>
            <button type="button" onClick={() => selectFever(false)} className={choiceClass}>No</button>
          </div>
        </StepShell>
      )}

      {step === 5 && (
        <StepShell stepKey={5}>
          <Bubble>Do you have any existing medical conditions? (diabetes, blood pressure, heart disease, etc.)</Bubble>
          <Composer value={conditionsDraft} onChange={setConditionsDraft} onSubmit={() => submitConditions()} placeholder="e.g. diabetes, high blood pressure" accessToken={accessToken} />
          <SkipButton onClick={() => submitConditions(true)} />
        </StepShell>
      )}

      {step === 6 && (
        <StepShell stepKey={6}>
          <Bubble>Are you currently taking any medicines?</Bubble>
          <Composer value={medicinesDraft} onChange={setMedicinesDraft} onSubmit={() => submitMedicines()} placeholder="e.g. Panadol, Augmentin" accessToken={accessToken} />
          <SkipButton onClick={() => submitMedicines(true)} />
        </StepShell>
      )}

      {step === 7 && (
        <StepShell stepKey={7}>
          <Bubble>Any known allergies — medicines, food, anything else?</Bubble>
          <Composer value={allergiesDraft} onChange={setAllergiesDraft} onSubmit={() => submitAllergies()} placeholder="e.g. penicillin" accessToken={accessToken} />
          <SkipButton onClick={() => submitAllergies(true)} />
        </StepShell>
      )}

      {step === 8 && (
        <StepShell stepKey={8}>
          <Bubble>What is your age?</Bubble>
          <Composer value={ageDraft} onChange={setAgeDraft} onSubmit={submitAge} placeholder="e.g. 34, or '2 months' for an infant" inputMode="numeric" voice={false} accessToken={accessToken} />
        </StepShell>
      )}

      {step === 9 && (
        <StepShell stepKey={9}>
          <Bubble>One last thing — are you currently pregnant?</Bubble>
          <div className="flex w-full flex-wrap gap-2">
            <button type="button" onClick={() => selectPregnant(true)} className={choiceClass}>Yes</button>
            <button type="button" onClick={() => selectPregnant(false)} className={choiceClass}>No</button>
            <button type="button" onClick={() => selectPregnant(null)} className={cn(choiceClass, "text-text-secondary")}>Not applicable</button>
          </div>
        </StepShell>
      )}
    </div>
  );
}
