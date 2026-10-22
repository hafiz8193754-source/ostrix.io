"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { PrescriptionReviewPanel } from "@/components/doctor/PrescriptionReviewPanel";
import { PresenceWidget } from "@/components/doctor/PresenceWidget";
import { ScheduleManager } from "@/components/doctor/ScheduleManager";
import { TodaySlotsTimeline } from "@/components/doctor/TodaySlotsTimeline";
import { useDoctorPresence } from "@/hooks/useDoctorPresence";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import { AlertTriangle, Ban, Clock, HelpCircle, Loader2, PhoneCall, ShieldCheck, Stethoscope } from "lucide-react";
import type { Appointment, Doctor, Prescription } from "@/types";

const EXPIRY_WARNING_DAYS = 60;

function VerificationBanner({ doctor }: { doctor: Doctor }) {
  if (doctor.registration_status === "verified") return null;

  if (doctor.registration_status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Verification in progress. You&apos;ll be notified within 24-48 hours. You cannot accept patients or sign prescriptions until verified.
      </div>
    );
  }

  if (doctor.registration_status === "under_review") {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-700">
        <span className="flex items-center gap-2 font-medium">
          <HelpCircle className="h-4 w-4 shrink-0" /> More information needed
        </span>
        {doctor.registration_note && <p>{doctor.registration_note}</p>}
      </div>
    );
  }

  if (doctor.registration_status === "rejected") {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
        <span className="flex items-center gap-2 font-medium">
          <Ban className="h-4 w-4 shrink-0" /> Registration rejected
        </span>
        {doctor.rejection_reason && <p>{doctor.rejection_reason}</p>}
        <p className="text-xs">Contact support if you believe this was a mistake.</p>
      </div>
    );
  }

  // suspended
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
      <span className="flex items-center gap-2 font-medium">
        <Ban className="h-4 w-4 shrink-0" /> Account suspended
      </span>
      {doctor.rejection_reason && <p>{doctor.rejection_reason}</p>}
    </div>
  );
}

function ExpiryWarningBanner({ doctor }: { doctor: Doctor }) {
  if (doctor.registration_status !== "verified" || !doctor.pmdc_expiry_date) return null;
  const daysLeft = Math.ceil((new Date(doctor.pmdc_expiry_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft > EXPIRY_WARNING_DAYS || daysLeft < 0) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-700">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      Your PMDC registration expires on {doctor.pmdc_expiry_date}. Please renew and upload your updated certificate to avoid
      suspension.
    </div>
  );
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const [doctor, setDoctor] = useState<Doctor | null | undefined>(undefined);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pending, setPending] = useState<Prescription[]>([]);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [calledId, setCalledId] = useState<string | null>(null);
  const [callError, setCallError] = useState("");

  useDoctorPresence(doctor ? session : null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setSession(data.session);
    });
  }, [router]);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await fetch("/api/doctor/dashboard", { headers: { authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setDoctor(data.doctor);
    setAppointments(data.todaysAppointments || []);
    setPending(data.pendingPrescriptions || []);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function startCall(appointmentId: string) {
    if (!session) return;
    setCallingId(appointmentId);
    setCallError("");
    try {
      const res = await fetch("/api/doctor/call", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the call.");
      setCalledId(appointmentId);
    } catch (e) {
      setCallError((e as Error).message);
    } finally {
      setCallingId(null);
    }
  }

  if (session === undefined || doctor === undefined) return null;

  if (!doctor) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-base px-6 text-center">
        <Stethoscope className="h-10 w-10 text-text-muted" />
        <h1 className="font-display text-xl font-bold text-text-primary">You're not registered as a doctor yet</h1>
        <p className="max-w-md text-sm text-text-secondary">Register your PMDC number to receive patient bookings and manage prescriptions.</p>
        <button onClick={() => router.push("/doctor/register")} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black">
          Register now
        </button>
      </div>
    );
  }

  const isVerified = doctor.registration_status === "verified";

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OstrixLogo size="sm" withWordmark />
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary">Dr. {doctor.full_name}</p>
          <p className="text-xs text-text-muted">
            {doctor.specialization.replace(/_/g, " ")} · PMDC #{doctor.pmdc_number}
          </p>
        </div>
      </div>

      <VerificationBanner doctor={doctor} />
      <ExpiryWarningBanner doctor={doctor} />

      <PresenceWidget doctor={doctor} accessToken={session!.access_token} onUpdated={(d) => setDoctor(d)} />

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg font-bold text-text-primary">
          <Clock className="h-4 w-4" /> Today's appointments
        </h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-text-muted">No appointments today.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-bg-surface px-4 py-2.5 text-sm">
                <span className="text-text-primary">
                  {a.appointment_time.slice(0, 5)} · {a.type === "online" ? "Online" : "Walk-in"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs capitalize text-text-secondary">{a.status.replace(/_/g, " ")}</span>
                  {a.type === "online" && a.status !== "completed" && a.status !== "cancelled" && (
                    <button
                      onClick={() => startCall(a.id)}
                      disabled={callingId === a.id || calledId === a.id}
                      className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-black disabled:opacity-60"
                    >
                      {callingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3" />}
                      {calledId === a.id ? "Calling…" : "Call"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {callError && <p className="mt-1 text-xs text-red-600">{callError}</p>}
      </section>

      {isVerified && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-text-primary">Today's slots</h2>
          <TodaySlotsTimeline accessToken={session!.access_token} appointments={appointments} />
        </section>
      )}

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg font-bold text-text-primary">
          <ShieldCheck className="h-4 w-4" /> Prescriptions to review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing pending review.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}
                className="flex items-center justify-between rounded-lg border border-border bg-bg-surface px-4 py-2.5 text-left text-sm hover:border-accent"
              >
                <span className="text-text-primary">{(p.doctor_edited_prescription || p.ai_generated_prescription).diagnosis || "Untitled draft"}</span>
                <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs capitalize text-text-secondary">{p.status.replace(/_/g, " ")}</span>
              </button>
            ))}
          </div>
        )}

        {selected && isVerified && (
          <div className="mt-4">
            <PrescriptionReviewPanel
              prescription={selected}
              doctor={doctor}
              accessToken={session!.access_token}
              onReviewed={() => {
                setSelected(null);
                load();
              }}
              onSignatureSaved={(signature_url) => setDoctor((d) => (d ? { ...d, signature_url } : d))}
            />
          </div>
        )}
        {selected && !isVerified && <p className="mt-4 text-sm text-yellow-700">Verification is required before you can review and sign this draft.</p>}
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg font-bold text-text-primary">Weekly schedule</h2>
        <ScheduleManager accessToken={session!.access_token} />
      </section>

      <p className="text-[11px] text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
