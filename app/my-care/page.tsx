"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { ArrowLeft, CalendarDays, FileText, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { PrescriptionCard } from "@/components/doctor/PrescriptionCard";
import { CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import type { Appointment, Doctor, Patient, Prescription } from "@/types";

type Care = { patient: Patient | null; appointments: Appointment[]; prescriptions: Prescription[]; doctors: Doctor[] };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700",
  confirmed: "bg-accent/15 text-text-primary",
  in_progress: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-700",
  cancelled: "bg-red-500/10 text-red-600",
  no_show: "bg-red-500/10 text-red-600",
};

// Patient-facing page: my appointments and my signed prescriptions (PDF download).
export default function MyCarePage() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setSession(data.session);
    });
  }, [router]);

  async function load(s: SupabaseSession) {
    const res = await fetch("/api/patient/care", { headers: { authorization: `Bearer ${s.access_token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "Could not load your care records.");
    else setCare(data as Care);
  }

  useEffect(() => {
    if (session) load(session);
  }, [session]);

  async function cancel(id: string) {
    if (!session) return;
    setCancelling(id);
    await fetch("/api/doctor/appointment", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ appointment_id: id, status: "cancelled" }),
    });
    setCancelling(null);
    await load(session);
  }

  const doctorById = (id: string) => care?.doctors.find((d) => d.id === id);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <OstrixLogo size="sm" withWordmark />
        <Link href="/studio" className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to assistant
        </Link>
      </div>
      <h1 className="font-display text-2xl font-bold text-text-primary">My care</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!care && !error && <Loader2 className="h-5 w-5 animate-spin text-text-muted" />}

      {care && (
        <>
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg font-bold text-text-primary">
              <CalendarDays className="h-4 w-4" /> Appointments
            </h2>
            {care.appointments.length === 0 ? (
              <p className="text-sm text-text-muted">
                No appointments yet. Describe your symptoms in the <Link href="/studio" className="text-accent">assistant</Link> to find a doctor.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {care.appointments.map((a) => {
                  const d = doctorById(a.doctor_id);
                  return (
                    <div key={a.id} data-testid="my-appointment" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{d ? `Dr. ${d.full_name.replace(/^dr\.?\s+/i, "")}` : "Doctor"}</p>
                        <p className="text-xs text-text-muted">
                          {a.appointment_date} · {a.appointment_time.slice(0, 5)} · {a.type === "online" ? "Online" : "Walk-in"}
                          {d?.clinic_name ? ` · ${d.clinic_name}, ${d.city}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[a.status] || ""}`}>{a.status.replace(/_/g, " ")}</span>
                        {(a.status === "pending" || a.status === "confirmed") && (
                          <button onClick={() => cancel(a.id)} disabled={cancelling === a.id} className="text-xs font-medium text-red-600 disabled:opacity-50">
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg font-bold text-text-primary">
              <FileText className="h-4 w-4" /> Prescriptions
            </h2>
            {care.prescriptions.length === 0 || !care.patient ? (
              <p className="text-sm text-text-muted">No signed prescriptions yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {care.prescriptions.map((p) => {
                  const d = doctorById(p.doctor_id);
                  if (!d || !session) return null;
                  return <PrescriptionCard key={p.id} prescription={p} doctor={d} patient={care.patient as Patient} accessToken={session.access_token} />;
                })}
              </div>
            )}
          </section>
        </>
      )}
      <p className="text-[11px] text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
