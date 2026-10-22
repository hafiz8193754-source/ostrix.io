"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { AlertTriangle, ArrowLeft, Loader2, Phone, Stethoscope } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { VoiceRecordButton } from "@/components/shared/VoiceRecordButton";
import { DoctorDirectory } from "@/components/doctor/DoctorDirectory";
import { triageSafetyNet, type TriageResult } from "@/lib/triage";
import type { Appointment, DoctorWithPresence } from "@/types";

type TriageResponse = {
  triage: TriageResult;
  emergency: boolean;
  matched_specialty?: string;
  doctors: DoctorWithPresence[];
  hospitals?: { name: string; phone: string }[];
  disclaimer: string;
};

const DISCLAIMER =
  "This is not a diagnosis. Ostrix's AI only suggests which kind of doctor to see — a licensed doctor makes every medical decision. In an emergency call 1122.";

const URGENCY_STYLE: Record<string, string> = {
  urgent: "bg-orange-500/10 text-orange-700",
  routine: "bg-green-500/10 text-green-700",
};

function EmergencyCallout({ match, hospitals }: { match?: string | null; hospitals?: { name: string; phone: string }[] }) {
  return (
    <div data-testid="triage-emergency" role="alert" className="flex flex-col gap-3 rounded-xl border-2 border-red-500 bg-red-500/10 p-4">
      <p className="flex items-center gap-2 font-display text-lg font-bold text-red-600">
        <AlertTriangle className="h-5 w-5" /> This may be an emergency
      </p>
      <p className="text-sm text-text-primary">
        Don&apos;t wait for an online appointment. <b>Call 1122 now</b> or go to the nearest hospital emergency department.
        {match ? <span className="block text-xs text-text-secondary">Detected: {match}</span> : null}
      </p>
      <a href="tel:1122" className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white sm:w-auto sm:self-start">
        <Phone className="h-4 w-4" /> Call 1122
      </a>
      {hospitals?.length ? (
        <ul className="text-xs text-text-secondary">
          {hospitals.map((h) => (
            <li key={h.name}>
              {h.name}: <a className="underline" href={`tel:${h.phone}`}>{h.phone}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function TriagePage() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace(`/login?next=${encodeURIComponent("/triage")}`);
      else setSession(data.session);
    });
  }, [router]);

  // Instant client-side net: the banner shows before any network round trip.
  const localMatch = symptoms.trim() ? triageSafetyNet(symptoms) : null;

  async function analyse() {
    if (!session || symptoms.trim().length < 3) return;
    setLoading(true);
    setError("");
    setResult(null);
    setBooked(null);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ symptoms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not analyse symptoms.");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function api(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  const t = result?.triage;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <OstrixLogo size="sm" withWordmark />
        <Link href="/my-care" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> My care
        </Link>
      </div>
      <div>
        <h1 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">Find the right doctor</h1>
        <p className="text-sm text-text-secondary">Type or speak your symptoms — English, اردو or Roman Urdu all work.</p>
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          data-testid="triage-input"
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          rows={4}
          placeholder="e.g. mujhe 3 din se bukhar aur gale mein dard hai"
          className="w-full rounded-2xl border border-border bg-bg-surface p-4 text-[15px] text-text-primary shadow-card outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent-glow"
        />
        <div className="flex items-center gap-2">
          {session && <VoiceRecordButton accessToken={session.access_token} onTranscribed={(x) => setSymptoms((s) => (s ? `${s} ${x}` : x))} />}
          <button
            data-testid="triage-submit"
            onClick={analyse}
            disabled={loading || symptoms.trim().length < 3}
            className="flex h-10 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg shadow-card transition-all hover:bg-accent-hover hover:shadow-lift disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Find a doctor
          </button>
        </div>
        <p className="text-[11px] text-text-muted">{DISCLAIMER}</p>
      </div>

      {localMatch && !result && <EmergencyCallout match={localMatch} />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && t && result.emergency && <EmergencyCallout match={t.safety_net_match} hospitals={result.hospitals} />}

      {result && t && !result.emergency && (
        <div className="flex flex-col gap-4">
          <div data-testid="triage-result" className="flex flex-col gap-2 rounded-2xl border border-border bg-bg-surface shadow-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-lg font-bold text-text-primary">{t.specialty}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${URGENCY_STYLE[t.urgency] || ""}`}>{t.urgency}</span>
            </div>
            <p className="text-sm text-text-secondary">{t.summary}</p>
            {t.urgency === "urgent" && <p className="text-xs font-medium text-orange-700">Please try to see a doctor today.</p>}
            {t.red_flags.length > 0 && (
              <div className="text-xs text-text-secondary">
                <p className="font-medium text-red-600">Go to hospital / call 1122 if you notice:</p>
                <ul className="ml-4 list-disc">{t.red_flags.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
          </div>

          {result.matched_specialty && result.matched_specialty !== t.specialty && (
            <p className="text-xs text-text-muted">No {t.specialty} is available yet, so here are General Physicians who can see you first.</p>
          )}
          {booked ? (
            <div className="rounded-xl border border-accent bg-accent/10 p-4 text-sm text-text-primary">
              {booked} <Link href="/my-care" className="font-medium text-accent">Go to My care →</Link>
            </div>
          ) : result.doctors.length === 0 ? (
            <p className="text-sm text-text-muted">No approved doctors are available right now. Please check back soon.</p>
          ) : (
            <DoctorDirectory
              doctors={result.doctors}
              aiAnalysis={{
                source: "triage",
                suggested_specialization: t.specialty,
                urgency: t.urgency,
                triage_summary: t.summary,
                red_flags: t.red_flags,
                intake: { symptoms, triage_summary: t.summary, urgency: t.urgency },
              }}
              symptomsDescription={symptoms}
              api={api as (path: string, body: unknown) => Promise<{ appointment: Appointment; confirmation_message: string }>}
              onBooked={(_a, message) => setBooked(message)}
            />
          )}
        </div>
      )}
    </div>
  );
}
