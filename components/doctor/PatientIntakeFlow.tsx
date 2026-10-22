"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Utensils, Sparkles, Bone, Baby, Flower2, Eye, Smile, HeartPulse, type LucideIcon } from "lucide-react";

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

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 self-start">
      <div className="mt-1 shrink-0">
        <OstrixLogo size="xs" />
      </div>
      <div className="max-w-[560px] rounded-[18px] rounded-bl-sm border border-border bg-bg-surface px-5 py-3.5 text-[15px] leading-[1.65] text-text-primary">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("self-end rounded-[18px] rounded-br-sm bg-bg-elevated px-5 py-3.5 text-[15px] leading-[1.65] text-text-primary", className)}>
      {children}
    </div>
  );
}

function StepShell({ children, stepKey }: { children: React.ReactNode; stepKey: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);
  return (
    <motion.div
      key={stepKey}
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3"
    >
      {children}
    </motion.div>
  );
}

const inputClass =
  "h-11 flex-1 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent";

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
    <div className="flex flex-col gap-4 pb-4">
      {step === 1 ? (
        <StepShell stepKey={1}>
          <Bubble>What's wrong? Pick a category, or describe it yourself.</Bubble>
          <div className="grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.label}
                onClick={() => selectCategory(c)}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-bg-surface p-3 text-left text-sm text-text-primary transition-colors hover:border-accent hover:bg-accent-glow"
              >
                <c.icon className="h-4 w-4 shrink-0 text-accent" /> {c.label}
              </button>
            ))}
          </div>
          <div className="flex max-w-[560px] items-center gap-2">
            <input
              value={whatsWrongDraft}
              onChange={(e) => setWhatsWrongDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitWhatsWrong()}
              placeholder="Or describe it in your own words…"
              className={inputClass}
            />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setWhatsWrongDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={submitWhatsWrong} disabled={!whatsWrongDraft.trim()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:cursor-not-allowed disabled:opacity-40">
              Send
            </button>
          </div>
        </StepShell>
      ) : (
        intake.whatsWrong && <UserBubble>{intake.whatsWrong}</UserBubble>
      )}

      {step === 2 && (
        <StepShell stepKey={2}>
          <Bubble>How long has this been going on?</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input
              autoFocus
              value={durationDraft}
              onChange={(e) => setDurationDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDuration()}
              placeholder="e.g. 3 days, since this morning, 2 weeks"
              className={inputClass}
            />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setDurationDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={submitDuration} disabled={!durationDraft.trim()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:cursor-not-allowed disabled:opacity-40">
              Send
            </button>
          </div>
        </StepShell>
      )}
      {step > 2 && intake.duration && <UserBubble>{intake.duration}</UserBubble>}

      {step === 3 && (
        <StepShell stepKey={3}>
          <Bubble>How severe would you say it is?</Bubble>
          <div className="flex max-w-[560px] gap-2">
            {(["mild", "moderate", "severe"] as const).map((s) => (
              <button
                key={s}
                onClick={() => selectSeverity(s)}
                className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium capitalize text-text-primary hover:border-accent hover:bg-accent-glow"
              >
                {s}
              </button>
            ))}
          </div>
        </StepShell>
      )}
      {step > 3 && intake.severity && <UserBubble className="capitalize">{intake.severity}</UserBubble>}

      {step === 4 && (
        <StepShell stepKey={4}>
          <Bubble>Any fever?</Bubble>
          <div className="flex max-w-[560px] gap-2">
            <button onClick={() => selectFever(true)} className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
              Yes
            </button>
            <button onClick={() => selectFever(false)} className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
              No
            </button>
          </div>
        </StepShell>
      )}
      {step > 4 && intake.hasFever !== null && <UserBubble>{intake.hasFever ? "Yes" : "No"}</UserBubble>}

      {step === 5 && (
        <StepShell stepKey={5}>
          <Bubble>Do you have any existing medical conditions? (diabetes, blood pressure, heart disease, etc.)</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={conditionsDraft} onChange={(e) => setConditionsDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitConditions()} placeholder="e.g. diabetes, high blood pressure" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setConditionsDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={() => submitConditions()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg">
              Send
            </button>
          </div>
          <button onClick={() => submitConditions(true)} className="self-start text-xs font-medium text-text-secondary hover:text-accent">
            None
          </button>
        </StepShell>
      )}
      {step > 5 && <UserBubble>{intake.existingConditions || "None"}</UserBubble>}

      {step === 6 && (
        <StepShell stepKey={6}>
          <Bubble>Are you currently taking any medicines?</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={medicinesDraft} onChange={(e) => setMedicinesDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitMedicines()} placeholder="e.g. Panadol, Augmentin" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setMedicinesDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={() => submitMedicines()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg">
              Send
            </button>
          </div>
          <button onClick={() => submitMedicines(true)} className="self-start text-xs font-medium text-text-secondary hover:text-accent">
            None
          </button>
        </StepShell>
      )}
      {step > 6 && <UserBubble>{intake.currentMedicines || "None"}</UserBubble>}

      {step === 7 && (
        <StepShell stepKey={7}>
          <Bubble>Any known allergies — medicines, food, anything else?</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={allergiesDraft} onChange={(e) => setAllergiesDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAllergies()} placeholder="e.g. penicillin" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setAllergiesDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={() => submitAllergies()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg">
              Send
            </button>
          </div>
          <button onClick={() => submitAllergies(true)} className="self-start text-xs font-medium text-text-secondary hover:text-accent">
            None
          </button>
        </StepShell>
      )}
      {step > 7 && <UserBubble>{intake.allergies || "None"}</UserBubble>}

      {step === 8 && (
        <StepShell stepKey={8}>
          <Bubble>What is your age?</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={ageDraft} onChange={(e) => setAgeDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAge()} inputMode="numeric" placeholder="e.g. 34, or '2 months' for an infant" className={inputClass} />
            <button onClick={submitAge} disabled={!ageDraft.trim()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:cursor-not-allowed disabled:opacity-40">
              Send
            </button>
          </div>
        </StepShell>
      )}
      {step > 8 && intake.age && <UserBubble>{intake.age}</UserBubble>}

      {step === 9 && (
        <StepShell stepKey={9}>
          <Bubble>One last thing — are you currently pregnant?</Bubble>
          <div className="flex max-w-[560px] gap-2">
            <button onClick={() => selectPregnant(true)} className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
              Yes
            </button>
            <button onClick={() => selectPregnant(false)} className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
              No
            </button>
            <button onClick={() => selectPregnant(null)} className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-secondary hover:border-accent hover:text-text-primary">
              Not applicable
            </button>
          </div>
        </StepShell>
      )}
    </div>
  );
}
