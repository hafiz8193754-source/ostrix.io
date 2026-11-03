"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { normalizePhone, type DaySlots } from "@/lib/slots";
import type { PublicDoctor } from "@/lib/publicDoctors";
import { doctorName } from "@/lib/doctorDisplay";

const input =
  "h-12 w-full min-w-0 rounded-xl border border-border bg-bg-elevated px-3 text-base text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent";

export function BookingForm({ doctor, initialDays }: { doctor: PublicDoctor; initialDays: DaySlots[] }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [slot, setSlot] = useState<{ date: string; time: string } | null>(null);
  const [type, setType] = useState<"online" | "walk_in">(doctor.accepts_online ? "online" : "walk_in");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [done, setDone] = useState<{ message: string; date: string; time: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  async function submit() {
    setError(null);
    if (!slot) return setError("Pick a date and time.");
    if (!name.trim()) return setError("Enter your full name.");
    if (!normalizePhone(phone)) return setError("Enter your phone with country code, e.g. +92 300 1234567.");
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/doctor/appointment", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          doctor_id: doctor.id,
          date: slot.date,
          time: slot.time,
          type,
          symptoms_description: symptoms.trim() || undefined,
          patient: { full_name: name.trim(), phone: phone.trim() },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.code === "slot_unavailable") {
          setSlot(null);
          setRefreshKey((k) => k + 1);
        }
        throw new Error(j.error || "Could not book.");
      }
      setDone({ message: j.confirmation_message, date: slot.date, time: slot.time });
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  }

  if (done)
    return (
      <div data-testid="booking-confirmation" className="flex flex-col gap-3 rounded-2xl border border-accent bg-accent-soft p-5">
        <p className="flex items-center gap-2 text-lg font-semibold text-text-primary">
          <CheckCircle2 className="h-6 w-6 text-accent" /> Booking received
        </p>
        <p className="text-base text-text-primary">{done.message}</p>
        <p className="text-sm text-text-secondary">
          We&apos;ll text you on {normalizePhone(phone)} when it&apos;s confirmed and about 1 hour before your visit.
        </p>
        <Link href="/my-care" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-5 text-base font-semibold text-accent-fg">
          Go to My care to pay &amp; join
        </Link>
      </div>
    );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SlotPicker doctorId={doctor.id} value={slot} onChange={setSlot} initialDays={initialDays} refreshKey={refreshKey} />

      {initialDays.length > 0 && (
        <>
          {doctor.accepts_online && doctor.accepts_walk_in && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Visit type">
              {(["online", "walk_in"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => setType(t)}
                  className={`min-h-[44px] rounded-xl border text-sm font-semibold ${type === t ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-text-primary"}`}
                >
                  {t === "online" ? "Online visit" : "Walk-in"}
                </button>
              ))}
            </div>
          )}

          {session === undefined ? null : !session ? (
            <Link
              href={`/login?next=/doctors/${doctor.id}`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-5 text-base font-semibold text-accent-fg"
            >
              Sign in to book
            </Link>
          ) : (
            <>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
              <input
                className={input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone with country code, +92 300 1234567"
                inputMode="tel"
                autoComplete="tel"
              />
              <textarea
                className={`${input} h-24 py-2`}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Symptoms (optional)"
              />
              {slot && (
                <p className="text-sm text-text-secondary">
                  {doctorName(doctor.full_name)} · {slot.date} at {slot.time} PKT
                  {doctor.consultation_fee_pkr > 0 ? ` · PKR ${doctor.consultation_fee_pkr.toLocaleString()}` : ""}
                </p>
              )}
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-semibold text-accent-fg disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm booking
              </button>
              <p className="text-xs text-text-muted">The doctor confirms once your bank-transfer payment is approved.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
