"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { PrescriptionReviewPanel } from "@/components/doctor/PrescriptionReviewPanel";
import { PresenceWidget } from "@/components/doctor/PresenceWidget";
import { ScheduleManager } from "@/components/doctor/ScheduleManager";
import { TodaySlotsTimeline } from "@/components/doctor/TodaySlotsTimeline";
import { VisitPanel } from "@/components/doctor/VisitPanel";
import { useDoctorPresence } from "@/hooks/useDoctorPresence";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import { AlertTriangle, Ban, Clock, HelpCircle, Loader2, PhoneCall, Play, ShieldCheck, Stethoscope, Video } from "lucide-react";
import type { Appointment, Doctor, Prescription } from "@/types";

type UpcomingAppointment = Appointment & {
  patient_name: string | null;
  patient_phone: string | null;
  patient_age: number | null;
  patient_gender: string | null;
  open_consultation_id: string | null;
};

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
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [visit, setVisit] = useState<{ appointment: UpcomingAppointment; consultationId: string } | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [phoneCallAvailable, setPhoneCallAvailable] = useState(false);

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
    setUpcoming(data.upcomingAppointments || []);
    setPending(data.pendingPrescriptions || []);
    setPhoneCallAvailable(!!data.phoneCallAvailable);
    return data as { pendingPrescriptions?: Prescription[] };
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function setAppointmentStatus(appointmentId: string, status: "confirmed" | "completed" | "cancelled") {
    if (!session) return;
    const res = await fetch("/api/doctor/appointment", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ appointment_id: appointmentId, status }),
    });
    if (res.ok) await load();
  }

  async function startVisit(a: UpcomingAppointment) {
    if (!session) return;
    setStartingId(a.id);
    setCallError("");
    try {
      const res = await fetch("/api/doctor/consultation", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ appointment_id: a.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the visit.");
      setVisit({ appointment: a, consultationId: data.consultation_id });
      await load();
    } catch (e) {
      setCallError((e as Error).message);
    } finally {
      setStartingId(null);
    }
  }

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
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 overflow-x-hidden px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <OstrixLogo size="sm" withWordmark />
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary">Dr. {doctor.full_name.replace(/^\s*dr\.?\s+/i, "")}</p>
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
          <Clock className="h-4 w-4" /> Upcoming appointments ({upcoming.length})
        </h2>
        {notice && <p className="mb-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-text-primary">{notice}</p>}
        {upcoming.length === 0 ? (
          <p className="text-sm text-text-muted">No upcoming appointments.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((a) => (
              <div key={a.id} data-testid="appointment-row" className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">
                      {a.patient_name || "Patient"}
                      {a.patient_age ? ` · ${a.patient_age}y` : ""}
                      {a.patient_gender ? ` · ${a.patient_gender}` : ""}
                    </p>
                    <p className="text-xs text-text-muted">
                      {a.appointment_date} · {a.appointment_time.slice(0, 5)} · {a.type === "online" ? "Online" : "Walk-in"}
                      {a.patient_phone ? ` · ${a.patient_phone}` : ""}
                    </p>
                    {a.symptoms_description && <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{a.symptoms_description}</p>}
                    {typeof (a.ai_symptom_analysis as Record<string, unknown> | null)?.triage_summary === "string" && (
                      <p data-testid="triage-summary" className="mt-1 line-clamp-3 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">AI triage{(a.ai_symptom_analysis as Record<string, unknown>).urgency ? ` (${String((a.ai_symptom_analysis as Record<string, unknown>).urgency)})` : ""}:</span>{" "}
                        {String((a.ai_symptom_analysis as Record<string, unknown>).triage_summary)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-xs capitalize text-text-secondary">{a.status.replace(/_/g, " ")}</span>
                    {isVerified && (
                      <>
                        {a.status === "pending" && (
                          <button onClick={() => setAppointmentStatus(a.id, "confirmed")} className="text-xs font-medium text-accent">
                            Confirm
                          </button>
                        )}
                        <button
                          onClick={() => startVisit(a)}
                          disabled={startingId === a.id}
                          className="flex items-center gap-1 rounded-full border border-accent px-2.5 py-0.5 text-xs font-medium text-accent disabled:opacity-60"
                        >
                          {startingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          {a.status === "in_progress" ? "Continue visit" : "Start visit"}
                        </button>
                        {a.type === "online" && (
                          <Link
                            href={`/visit/${a.id}`}
                            data-testid="join-video-visit"
                            className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-black"
                          >
                            <Video className="h-3 w-3" /> Join video visit
                          </Link>
                        )}
                        {a.type === "online" && phoneCallAvailable && (
                          <button
                            onClick={() => startCall(a.id)}
                            disabled={callingId === a.id || calledId === a.id}
                            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-text-secondary disabled:opacity-60"
                          >
                            {callingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PhoneCall className="h-3 w-3" />}
                            {calledId === a.id ? "Calling…" : "Phone call"}
                          </button>
                        )}
                        <button onClick={() => setAppointmentStatus(a.id, "completed")} className="text-xs font-medium text-text-secondary">
                          Complete
                        </button>
                        <button onClick={() => setAppointmentStatus(a.id, "cancelled")} className="text-xs font-medium text-red-600">
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {visit?.appointment.id === a.id && session && (
                  <VisitPanel
                    consultationId={visit.consultationId}
                    accessToken={session.access_token}
                    patientLabel={a.patient_name || "Patient"}
                    symptoms={a.symptoms_description}
                    onClose={() => setVisit(null)}
                    onDrafted={async (prescriptionId) => {
                      setVisit(null);
                      await setAppointmentStatus(a.id, "completed");
                      const data = await load();
                      const drafted = (data?.pendingPrescriptions || []).find((p) => p.id === prescriptionId);
                      if (drafted) setSelected(drafted);
                      setNotice("Visit completed. Review, edit and sign the prescription below.");
                    }}
                  />
                )}
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

      <section className="min-w-0">
        <h2 className="mb-2 font-display text-lg font-bold text-text-primary">Weekly schedule</h2>
        <ScheduleManager accessToken={session!.access_token} />
      </section>

      <p className="text-[11px] text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
