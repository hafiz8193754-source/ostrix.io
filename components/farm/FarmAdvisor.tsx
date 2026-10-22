"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { readSSEStream } from "@/lib/sse";
import { FarmIntakeFlow, type FarmIntakeSummary } from "@/components/farm/FarmIntakeFlow";
import { FarmPlanCard } from "@/components/farm/FarmPlanCard";
import type { ChatMessage, FarmMeta, FarmPlan } from "@/types";

type Step = "intro" | "generating" | "done" | "error";

interface FarmAdvisorProps {
  accessToken: string;
  // Fired so the parent (studio page) can persist this live-only component's
  // interaction into the same sessions/messages tables every other agent
  // uses — mirrors DoctorHealthAssistant's onSymptomsSubmitted/onResult contract.
  onIntakeSubmitted?: (text: string) => void;
  onResult?: (message: ChatMessage) => void;
}

// Live persistent component above the thread (not a chat-embedded form) —
// mirrors components/doctor/DoctorHealthAssistant.tsx's architecture.
// /api/farm streams status/done/error frames; done's payload is a structured
// {plan, remaining} object rather than plain text, so this reads the raw SSE
// stream directly (lib/sse.ts's readSSEStream) instead of going through
// useSSEChat, whose done-event contract assumes a text field.
export function FarmAdvisor({ accessToken, onIntakeSubmitted, onResult }: FarmAdvisorProps) {
  const [step, setStep] = useState<Step>("intro");
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<{ plan: FarmPlan; meta: FarmMeta } | null>(null);

  async function runPlan(briefText: string, intake: FarmIntakeSummary) {
    onIntakeSubmitted?.(briefText);
    setStep("generating");
    setStatus("Reading your details…");

    const waterSource = intake.waterReliability ? `${intake.waterSource} (${intake.waterReliability})` : intake.waterSource;

    try {
      const res = await fetch("/api/farm", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          district: intake.district,
          landSize: intake.landSize,
          soilType: intake.soilType,
          waterSource,
          previousCrop: intake.previousCrop,
          budget: intake.budget,
          problem: intake.problem,
          photo: intake.photo,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status}).`);
      }

      let plan: FarmPlan | null = null;
      await readSSEStream(res, (eventName, dataStr) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(dataStr);
        } catch {
          return;
        }
        if (eventName === "status" && typeof data.message === "string") setStatus(data.message);
        else if (eventName === "done") plan = (data as unknown as { plan: FarmPlan }).plan;
        else if (eventName === "error") throw new Error(typeof data.message === "string" ? data.message : "Could not produce the plan.");
      });

      if (!plan) throw new Error("Could not produce the plan just now — please try again.");
      const meta: FarmMeta = { district: intake.district, land: intake.landSize };
      setResult({ plan, meta });
      setStep("done");
      onResult?.({ role: "agent", plan, meta });
    } catch (e) {
      setErrorMessage((e as Error).message);
      setStep("error");
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {step === "intro" && <FarmIntakeFlow accessToken={accessToken} onComplete={runPlan} />}

      {step === "generating" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 self-start rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm text-text-secondary"
        >
          <Loader2 className="h-4 w-4 animate-spin text-accent" /> {status || "Preparing your season plan…"}
        </motion.div>
      )}

      {step === "error" && (
        <div className="self-start rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">{errorMessage}</div>
      )}

      {step === "done" && result && <FarmPlanCard plan={result.plan} meta={result.meta} />}
    </div>
  );
}
