"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import { CheckCircle2 } from "lucide-react";

import { RegistrationProgressBar } from "@/components/doctor/registration/RegistrationProgressBar";
import { StepAccount } from "@/components/doctor/registration/StepAccount";
import { StepCredentials } from "@/components/doctor/registration/StepCredentials";
import { StepPractice } from "@/components/doctor/registration/StepPractice";
import { StepDocuments } from "@/components/doctor/registration/StepDocuments";
import { StepSchedule } from "@/components/doctor/registration/StepSchedule";
import { StepDeclarations } from "@/components/doctor/registration/StepDeclarations";
import { initialAnswers, type RegistrationAnswers } from "@/components/doctor/registration/types";

const DRAFT_KEY = "ostrix_doctor_registration_draft";
const TOTAL_STEPS = 6;

export default function DoctorRegister() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<RegistrationAnswers>(initialAnswers());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login?next=/doctor/register");
      else setSession(data.session);
    });
  }, [router]);

  // Load any saved draft once, and check whether this account already has a
  // doctor profile (mirrors the old single-step page's guard).
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch("/api/doctor/dashboard", { headers: { authorization: `Bearer ${session.access_token}` } });
        const data = await res.json();
        setHasProfile(!!data.doctor);
      } catch {
        setHasProfile(false);
      }
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) setAnswers({ ...initialAnswers(), ...JSON.parse(saved) });
      } catch {
        // corrupt/unavailable draft — start fresh
      }
    })();
  }, [session]);

  // Debounced draft autosave.
  useEffect(() => {
    if (!session || hasProfile) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
      } catch {
        // storage unavailable/full — draft persistence is best-effort
      }
    }, 400);
    return () => clearTimeout(t);
  }, [answers, session, hasProfile]);

  function patch(p: Partial<RegistrationAnswers>) {
    setAnswers((a) => ({ ...a, ...p }));
  }

  function next() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!session) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/doctor/register", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          full_name: answers.full_name.trim(),
          cnic: answers.cnic.trim(),
          email: answers.email.trim(),
          phone: answers.phone.trim(),
          whatsapp: answers.whatsappSame ? answers.phone.trim() : answers.whatsapp.trim(),
          pmdc_number: answers.pmdc_number.trim(),
          pmdc_registration_type: answers.pmdc_registration_type,
          pmdc_expiry_date: answers.pmdc_expiry_date,
          specialization: answers.specialization,
          sub_specialization: answers.sub_specialization.trim(),
          qualifications: answers.qualifications.trim(),
          year_of_graduation: parseInt(answers.year_of_graduation, 10),
          experience_years: parseInt(answers.experience_years, 10) || 0,
          languages: answers.languages,
          clinic_name: answers.clinic_name.trim(),
          clinic_address: answers.clinic_address.trim(),
          city: answers.city === "Other" ? answers.cityOther.trim() : answers.city,
          accepts_online: answers.accepts_online,
          accepts_walk_in: answers.accepts_walk_in,
          consultation_fee_pkr: parseInt(answers.consultation_fee_pkr, 10) || 0,
          max_daily_appointments: parseInt(answers.max_daily_appointments, 10) || 20,
          bio: answers.bio.trim(),
          pmdc_certificate_url: answers.pmdc_certificate_url,
          degree_certificate_url: answers.degree_certificate_url,
          cnic_front_url: answers.cnic_front_url,
          profile_photo_url: answers.profile_photo_url,
          schedule: answers.schedule
            .filter((r) => r.enabled)
            .map((r) => ({
              day_of_week: r.day_of_week,
              start_time: r.start_time,
              end_time: r.end_time,
              consultation_type: r.consultation_type,
              slot_duration_minutes: r.slot_duration_minutes,
            })),
          declaration_pmdc_valid: answers.declaration_pmdc_valid,
          declaration_ai_responsibility: answers.declaration_ai_responsibility,
          declaration_terms: answers.declaration_terms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not register.");
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // best-effort
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  }

  if (session === undefined || hasProfile === null) return null;

  if (hasProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-base px-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <h1 className="font-display text-xl font-bold text-text-primary">You're already registered</h1>
        <p className="max-w-md text-sm text-text-secondary">Head to your dashboard to check your verification status.</p>
        <button onClick={() => router.push("/doctor/dashboard")} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black">
          Go to dashboard
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-base px-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <h1 className="font-display text-xl font-bold text-text-primary">Registration submitted</h1>
        <p className="max-w-md text-sm text-text-secondary">
          Our team will verify your PMDC registration within 24-48 hours. You'll be notified once verified. Until then you
          can complete your profile but cannot accept patients or sign prescriptions.
        </p>
        <button onClick={() => router.push("/doctor/dashboard")} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black">
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center gap-2">
        <OstrixLogo size="sm" withWordmark />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Register as a doctor</h1>
        <p className="mt-1 text-sm text-text-secondary">Join Ostrix Clinical to receive patient bookings and manage prescriptions.</p>
      </div>

      <RegistrationProgressBar step={step} />

      {step === 1 && <StepAccount values={answers} onChange={patch} onNext={next} onBack={back} />}
      {step === 2 && <StepCredentials values={answers} onChange={patch} onNext={next} onBack={back} />}
      {step === 3 && <StepPractice values={answers} onChange={patch} onNext={next} onBack={back} />}
      {step === 4 && <StepDocuments values={answers} onChange={patch} onNext={next} onBack={back} />}
      {step === 5 && <StepSchedule values={answers} onChange={patch} onNext={next} onBack={back} />}
      {step === 6 && (
        <StepDeclarations values={answers} onChange={patch} onBack={back} onSubmit={submit} submitting={submitting} error={error} />
      )}

      <p className="text-center text-[11px] text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
