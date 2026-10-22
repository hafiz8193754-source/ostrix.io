"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { detectEmergency, CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import { EmergencyBanner } from "@/components/doctor/EmergencyBanner";
import { SpecialistCard } from "@/components/doctor/SpecialistCard";
import { DoctorDirectory } from "@/components/doctor/DoctorDirectory";
import { AppointmentConfirmation } from "@/components/doctor/AppointmentConfirmation";
import { PatientIntakeFlow, type IntakeSummary } from "@/components/doctor/PatientIntakeFlow";
import type { Appointment, ChatMessage, Doctor, DoctorWithPresence } from "@/types";

type AnalyzeResponse = {
  emergency: boolean;
  matched_keyword?: string | null;
  suggested_specialization?: string;
  suggested_specialization_display?: string;
  suggested_specialization_urdu?: string;
  urgency?: "routine" | "soon" | "urgent" | "emergency";
  reasoning?: string;
  questions_to_ask_doctor?: string[];
  red_flags?: string[];
  matching_doctors?: DoctorWithPresence[];
};

type Step = "intro" | "analyzing" | "emergency" | "specialist" | "booked";

interface DoctorHealthAssistantProps {
  api: (path: string, body: unknown) => Promise<unknown>;
  accessToken: string;
  sessionId?: string | null;
  // Fired so the parent (studio page) can persist this live-only component's
  // interaction into the same sessions/messages tables Builder/Farm already
  // use — see plan decision #4. A reopened past session shows these as a
  // plain read-only transcript rather than a resumed live flow.
  onSymptomsSubmitted?: (text: string) => void;
  onResult?: (message: ChatMessage) => void;
}

export function DoctorHealthAssistant({ api, accessToken, sessionId, onSymptomsSubmitted, onResult }: DoctorHealthAssistantProps) {
  const [step, setStep] = useState<Step>("intro");
  const [symptoms, setSymptoms] = useState("");
  const [intake, setIntake] = useState<IntakeSummary | null>(null);
  const [matchedKeyword, setMatchedKeyword] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [booking, setBooking] = useState<{ appointment: Appointment; message: string; doctor: Doctor } | null>(null);

  async function runAnalysis(text: string, structured: IntakeSummary) {
    setSymptoms(text);
    setIntake(structured);
    onSymptomsSubmitted?.(text);

    const { years: patientAge, months: patientAgeMonths } = parseAge(structured.age);

    // Instant client-side check — no network wait for an emergency banner.
    const clientCheck = detectEmergency(text);
    if (clientCheck.isEmergency) {
      setMatchedKeyword(clientCheck.matchedKeyword);
      setStep("emergency");
      onResult?.({ role: "agent", text: "🚨 Emergency detected — call 1122 immediately or go to the nearest ER." });
      api("/api/doctor/analyze", { symptoms: text, patientAge, patientAgeMonths }).catch(() => {});
      return;
    }

    setStep("analyzing");
    try {
      const result = (await api("/api/doctor/analyze", { symptoms: text, patientAge, patientAgeMonths })) as AnalyzeResponse;
      if (result.emergency) {
        setMatchedKeyword(result.matched_keyword ?? null);
        setStep("emergency");
        onResult?.({ role: "agent", text: "🚨 Emergency detected — call 1122 immediately or go to the nearest ER." });
        return;
      }
      setAnalysis(result);
      setStep("specialist");
      onResult?.({
        role: "agent",
        text: `Suggested specialist: ${result.suggested_specialization_display} (urgency: ${result.urgency}). ${result.reasoning || ""}`.trim(),
      });
    } catch (e) {
      setStep("intro");
      onResult?.({ role: "agent", text: `Sorry — ${(e as Error).message}` });
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {step === "intro" && <PatientIntakeFlow accessToken={accessToken} onComplete={runAnalysis} />}

      {step === "analyzing" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 self-start rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin text-accent" /> Analyzing your symptoms…
        </motion.div>
      )}

      {step === "emergency" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <EmergencyBanner matchedKeyword={matchedKeyword} />
        </motion.div>
      )}

      {step === "specialist" && analysis && !booking && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          <SpecialistCard
            specializationDisplay={analysis.suggested_specialization_display || ""}
            specializationUrdu={analysis.suggested_specialization_urdu || ""}
            urgency={analysis.urgency || "routine"}
            reasoning={analysis.reasoning || ""}
            redFlags={analysis.red_flags || []}
            questionsToAskDoctor={analysis.questions_to_ask_doctor || []}
          />
          <DoctorDirectory
            doctors={analysis.matching_doctors || []}
            aiAnalysis={{ ...(analysis as unknown as Record<string, unknown>), intake }}
            symptomsDescription={symptoms}
            sessionId={sessionId}
            api={api as (path: string, body: unknown) => Promise<{ appointment: Appointment; confirmation_message: string }>}
            onBooked={(appointment, message, doctor) => {
              setBooking({ appointment, message, doctor });
              onResult?.({ role: "agent", text: `Appointment booked with Dr. ${doctor.full_name}. ${message}` });
            }}
          />
        </motion.div>
      )}

      {booking && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <AppointmentConfirmation appointment={booking.appointment} confirmationMessage={booking.message} doctor={booking.doctor} accessToken={accessToken} />
        </motion.div>
      )}

      <p className="max-w-[560px] text-[11px] text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}

// Ages can be entered as plain years ("34") or an infant age like "2 months"
// — the two are mutually exclusive on the wire (patientAge vs
// patientAgeMonths) since /api/doctor/analyze's under-5-years urgency bump
// and under-3-months emergency rule are different checks.
function parseAge(raw: string): { years?: number; months?: number } {
  const match = raw.match(/\d+/);
  const num = match ? parseInt(match[0], 10) : undefined;
  if (num === undefined) return {};
  return /month/i.test(raw) ? { months: num } : { years: num };
}
