"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Droplets, Waves, CloudRain, type LucideIcon } from "lucide-react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { VoiceRecordButton } from "@/components/shared/VoiceRecordButton";
import { readPhoto } from "@/lib/image";
import { CROPS } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export interface FarmIntakeSummary {
  district: string;
  landSize: string;
  soilType: string;
  waterSource: string;
  waterReliability: string;
  previousCrop: string;
  budget: string;
  problem: string;
  photo: { data: string; type: string } | null;
  photoPreview: string | null;
}

export function buildFarmBriefText(intake: FarmIntakeSummary): string {
  return [
    `District: ${intake.district}.`,
    `Land size: ${intake.landSize}.`,
    `Soil type: ${intake.soilType || "not sure"}.`,
    `Water source: ${intake.waterSource}${intake.waterReliability ? ` (${intake.waterReliability})` : ""}.`,
    `Previous crop: ${intake.previousCrop || "none / first season"}.`,
    `Budget available: ${intake.budget || "not specified"}.`,
    intake.problem ? `Current problem: ${intake.problem}` : "No current problem reported.",
  ].join(" ");
}

const INITIAL: FarmIntakeSummary = {
  district: "",
  landSize: "",
  soilType: "",
  waterSource: "",
  waterReliability: "",
  previousCrop: "",
  budget: "",
  problem: "",
  photo: null,
  photoPreview: null,
};

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
    <motion.div key={stepKey} ref={ref} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col gap-3">
      {children}
    </motion.div>
  );
}

const inputClass =
  "h-11 flex-1 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent";

interface SoilOption {
  label: string;
  desc: string;
}
const SOIL_OPTIONS: SoilOption[] = [
  { label: "Clay", desc: "Heavy, holds water, sticky when wet" },
  { label: "Loamy", desc: "Balanced, drains well — good for most crops" },
  { label: "Sandy", desc: "Light, drains fast, dries out quickly" },
  { label: "Not sure", desc: "We'll estimate from your district" },
];

interface WaterOption {
  label: string;
  icon: LucideIcon;
}
const WATER_OPTIONS: WaterOption[] = [
  { label: "Canal", icon: Waves },
  { label: "Tubewell", icon: Droplets },
  { label: "Rain-fed", icon: CloudRain },
];

interface FarmIntakeFlowProps {
  accessToken: string;
  onComplete: (briefText: string, structured: FarmIntakeSummary) => void;
}

// One question at a time, in the simplest language — mirrors
// components/doctor/PatientIntakeFlow.tsx's proven bubble-step UX exactly.
// Every free-text step gets a press-and-hold mic (Urdu/Punjabi via the
// shared Whisper pipeline) that fills the field for review, never auto-sends.
export function FarmIntakeFlow({ accessToken, onComplete }: FarmIntakeFlowProps) {
  const [step, setStep] = useState(1);
  const [intake, setIntake] = useState<FarmIntakeSummary>(INITIAL);

  const [districtDraft, setDistrictDraft] = useState("");
  const [landDraft, setLandDraft] = useState("");
  const [cropDraft, setCropDraft] = useState("");
  const [budgetDraft, setBudgetDraft] = useState("");
  const [problemDraft, setProblemDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function goTo(n: number) {
    setStep(n);
  }

  function submitDistrict() {
    if (!districtDraft.trim()) return;
    setIntake((i) => ({ ...i, district: districtDraft.trim() }));
    goTo(2);
  }

  function submitLand() {
    if (!landDraft.trim()) return;
    setIntake((i) => ({ ...i, landSize: landDraft.trim() }));
    goTo(3);
  }

  function selectSoil(soil: SoilOption) {
    setIntake((i) => ({ ...i, soilType: soil.label === "Not sure" ? "" : soil.label }));
    goTo(4);
  }

  function selectWater(source: string) {
    setIntake((i) => ({ ...i, waterSource: source }));
    goTo(5);
  }

  function selectReliability(reliability: string) {
    setIntake((i) => ({ ...i, waterReliability: reliability }));
    goTo(6);
  }

  function submitCrop(skip = false) {
    setIntake((i) => ({ ...i, previousCrop: skip ? "" : cropDraft.trim() }));
    goTo(7);
  }

  function submitBudget(skip = false) {
    setIntake((i) => ({ ...i, budget: skip ? "" : budgetDraft.trim() }));
    goTo(8);
  }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const resized = await readPhoto(file);
      setIntake((i) => ({ ...i, photo: { data: resized.data, type: resized.type }, photoPreview: resized.preview }));
    } catch {
      // photo is optional — ignore a failed resize
    }
  }

  function finish(skip = false) {
    const final = { ...intake, problem: skip ? "" : problemDraft.trim() };
    setIntake(final);
    onComplete(buildFarmBriefText(final), final);
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {step === 1 ? (
        <StepShell stepKey={1}>
          <Bubble>Which district or area is your land in? — for example, Faisalabad</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={districtDraft} onChange={(e) => setDistrictDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitDistrict()} placeholder="e.g. Faisalabad" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setDistrictDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={submitDistrict} disabled={!districtDraft.trim()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40">
              Send
            </button>
          </div>
        </StepShell>
      ) : (
        intake.district && <UserBubble>{intake.district}</UserBubble>
      )}

      {step === 2 && (
        <StepShell stepKey={2}>
          <Bubble>How much land do you have? You can say it in acres or kanal — for example, 5 acres or 10 kanal</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={landDraft} onChange={(e) => setLandDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitLand()} placeholder="e.g. 5 acres" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setLandDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={submitLand} disabled={!landDraft.trim()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40">
              Send
            </button>
          </div>
        </StepShell>
      )}
      {step > 2 && intake.landSize && <UserBubble>{intake.landSize}</UserBubble>}

      {step === 3 && (
        <StepShell stepKey={3}>
          <Bubble>What kind of soil do you have? If you're not sure, that's okay — just say so.</Bubble>
          <div className="grid max-w-[560px] grid-cols-1 gap-2 sm:grid-cols-2">
            {SOIL_OPTIONS.map((s) => (
              <button key={s.label} onClick={() => selectSoil(s)} className="flex flex-col gap-0.5 rounded-xl border border-border bg-bg-surface p-3 text-left transition-colors hover:border-accent hover:bg-accent-glow">
                <span className="text-sm font-medium text-text-primary">{s.label}</span>
                <span className="text-xs text-text-muted">{s.desc}</span>
              </button>
            ))}
          </div>
        </StepShell>
      )}
      {step > 3 && <UserBubble>{intake.soilType || "Not sure"}</UserBubble>}

      {step === 4 && (
        <StepShell stepKey={4}>
          <Bubble>Where does your water come from?</Bubble>
          <div className="flex max-w-[560px] gap-2">
            {WATER_OPTIONS.map((w) => (
              <button key={w.label} onClick={() => selectWater(w.label)} className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border bg-bg-surface p-3 text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
                <w.icon className="h-4 w-4 text-accent" /> {w.label}
              </button>
            ))}
          </div>
        </StepShell>
      )}
      {step > 4 && intake.waterSource && <UserBubble>{intake.waterSource}</UserBubble>}

      {step === 5 && (
        <StepShell stepKey={5}>
          <Bubble>Is your water supply reliable, or does it sometimes run short?</Bubble>
          <div className="flex max-w-[560px] gap-2">
            <button onClick={() => selectReliability("Reliable")} className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
              Reliable
            </button>
            <button onClick={() => selectReliability("Sometimes short")} className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
              Sometimes short
            </button>
          </div>
        </StepShell>
      )}
      {step > 5 && intake.waterReliability && <UserBubble>{intake.waterReliability}</UserBubble>}

      {step === 6 && (
        <StepShell stepKey={6}>
          <Bubble>What did you grow last season, if anything?</Bubble>
          <div className="grid max-w-[560px] grid-cols-2 gap-2 sm:grid-cols-4">
            {CROPS.map((c) => (
              <button key={c} onClick={() => { setCropDraft(c); setIntake((i) => ({ ...i, previousCrop: c })); goTo(7); }} className="rounded-xl border border-border bg-bg-surface px-3 py-2 text-left text-xs font-medium text-text-primary hover:border-accent hover:bg-accent-glow">
                {c}
              </button>
            ))}
          </div>
          <div className="flex max-w-[560px] items-center gap-2">
            <input value={cropDraft} onChange={(e) => setCropDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitCrop()} placeholder="Or type it in your own words…" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setCropDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={() => submitCrop()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-black">
              Send
            </button>
          </div>
          <button onClick={() => submitCrop(true)} className="self-start text-xs font-medium text-text-secondary hover:text-accent">
            First season / skip
          </button>
        </StepShell>
      )}
      {step > 6 && <UserBubble>{intake.previousCrop || "First season"}</UserBubble>}

      {step === 7 && (
        <StepShell stepKey={7}>
          <Bubble>How much can you spend on this season — seed, fertilizer, and other inputs?</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={budgetDraft} onChange={(e) => setBudgetDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitBudget()} placeholder="e.g. 80,000 PKR" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setBudgetDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={() => submitBudget()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-black">
              Send
            </button>
          </div>
          <button onClick={() => submitBudget(true)} className="self-start text-xs font-medium text-text-secondary hover:text-accent">
            Prefer not to say
          </button>
        </StepShell>
      )}
      {step > 7 && <UserBubble>{intake.budget || "Not specified"}</UserBubble>}

      {step === 8 && (
        <StepShell stepKey={8}>
          <Bubble>Last thing — is anything wrong with your crop or land right now? Describe it, or attach a photo of the affected plant.</Bubble>
          <div className="flex max-w-[560px] items-center gap-2">
            <input autoFocus value={problemDraft} onChange={(e) => setProblemDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && finish()} placeholder="e.g. yellow spots on the leaves" className={inputClass} />
            <VoiceRecordButton accessToken={accessToken} onTranscribed={(t) => setProblemDraft((d) => (d ? `${d} ${t}` : t))} />
            <button onClick={() => finish()} className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-black">
              Send
            </button>
          </div>
          <div className="flex max-w-[560px] items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-text-secondary hover:border-accent hover:text-text-primary">
              <Camera className="h-3.5 w-3.5" /> {intake.photoPreview ? "Change photo" : "Attach a photo (optional)"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
            {intake.photoPreview && <img src={intake.photoPreview} alt="Attached plant" className="h-9 rounded-md" />}
            <button onClick={() => finish(true)} className="text-xs font-medium text-text-secondary hover:text-accent">
              Nothing wrong — skip
            </button>
          </div>
        </StepShell>
      )}
    </div>
  );
}

