"use client";

import { useState } from "react";
import { Star, Calendar, MessageCircle, Loader2, BadgeCheck, Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Appointment, Doctor, DoctorWithPresence } from "@/types";

interface DoctorDirectoryProps {
  doctors: DoctorWithPresence[];
  aiAnalysis: Record<string, unknown>;
  symptomsDescription: string;
  sessionId?: string | null;
  api: (path: string, body: unknown) => Promise<{ appointment: Appointment; confirmation_message: string }>;
  onBooked: (appointment: Appointment, confirmationMessage: string, doctor: Doctor) => void;
}

const PRESENCE_DOT: Record<DoctorWithPresence["presence"]["color"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-neutral-400",
};

function PresenceBadge({ presence }: { presence: DoctorWithPresence["presence"] }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
      <span className="relative flex h-2 w-2">
        {presence.color === "green" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", PRESENCE_DOT[presence.color])} />
      </span>
      {presence.label}
    </span>
  );
}

type FilterChip = "available_now" | "online" | "walk_in" | "any_time";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function nextAvailableDates(availableDays: string[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 14 && out.length < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayLabel = DAY_LABELS[d.getDay()];
    if (availableDays.length === 0 || availableDays.some((a) => a.toLowerCase().startsWith(dayLabel.toLowerCase()))) {
      out.push({ value: d.toISOString().slice(0, 10), label: `${dayLabel} ${d.getDate()}/${d.getMonth() + 1}` });
    }
  }
  return out;
}

export function DoctorDirectory({ doctors, aiAnalysis, symptomsDescription, sessionId, api, onBooked }: DoctorDirectoryProps) {
  const [bookingDoctorId, setBookingDoctorId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterChip>("any_time");
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState<"online" | "walk_in">("online");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [phone, setPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");

  function openBooking(doctor: Doctor) {
    setBookingDoctorId(doctor.id);
    setError(null);
    const dates = nextAvailableDates(doctor.available_days);
    setDate(dates[0]?.value || "");
    setTime(doctor.available_hours_start?.slice(0, 5) || "10:00");
    setType(doctor.accepts_online ? "online" : "walk_in");
  }

  async function confirmBooking(doctor: Doctor) {
    if (!name.trim() || !phone.trim() || !date || !time) {
      setError("Fill in your name, phone, date, and time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { appointment, confirmation_message } = await api("/api/doctor/appointment", {
        doctor_id: doctor.id,
        date,
        time,
        type,
        symptoms_description: symptomsDescription,
        ai_analysis: aiAnalysis,
        session_id: sessionId || undefined,
        patient: {
          full_name: name.trim(),
          age: age ? Number(age) : undefined,
          gender: gender || undefined,
          phone: phone.trim(),
          known_allergies: allergies.trim() ? allergies.split(",").map((s) => s.trim()) : [],
          current_medications: medications.trim() ? medications.split(",").map((s) => s.trim()) : [],
        },
      });
      onBooked(appointment, confirmation_message, doctor);
      setBookingDoctorId(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setSubmitting(false);
  }

  async function notifyMe(doctor: Doctor) {
    try {
      await api("/api/doctor/notify-me", { doctor_id: doctor.id });
      setNotifiedIds((ids) => [...ids, doctor.id]);
    } catch {
      // best-effort
    }
  }

  const filtered = doctors.filter((d) => {
    if (activeFilter === "available_now") return d.presence.is_bookable;
    if (activeFilter === "online") return d.accepts_online;
    if (activeFilter === "walk_in") return d.accepts_walk_in;
    return true;
  });

  if (doctors.length === 0) {
    return (
      <div className="max-w-[560px] rounded-2xl border border-border bg-bg-surface p-5 text-sm text-text-secondary">
        No verified doctors are listed for this specialization yet. Please try WhatsApp/phone booking with your usual clinic, or check back soon.
      </div>
    );
  }

  return (
    <div className="flex max-w-[560px] flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Available Doctors</p>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["any_time", "Any time"],
            ["available_now", "Available now"],
            ["online", "Online consultation"],
            ["walk_in", "Walk-in"],
          ] as [FilterChip, string][]
        ).map(([chip, label]) => (
          <button
            key={chip}
            onClick={() => setActiveFilter(chip)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium",
              activeFilter === chip ? "border-accent bg-accent-glow text-accent" : "border-border bg-bg-elevated text-text-secondary"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="text-xs text-text-muted">No doctors match this filter right now.</p>}

      {filtered.map((doctor) => (
        <div key={doctor.id} className="flex flex-col gap-2.5 rounded-xl border border-border bg-bg-elevated p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                Dr. {doctor.full_name.replace(/^\s*dr\.?\s+/i, "")}
                <span className="flex items-center gap-0.5 text-[10px] font-medium text-accent" title="PMDC Verified">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </span>
              </p>
              <p className="text-xs text-text-muted">
                {doctor.specialization.replace(/_/g, " ")} · {doctor.experience_years} years experience
              </p>
            </div>
            {doctor.rating > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-text-secondary">
                <Star className="h-3.5 w-3.5 fill-accent text-accent" /> {doctor.rating.toFixed(1)}
              </span>
            )}
          </div>
          <PresenceBadge presence={doctor.presence} />
          {doctor.clinic_name && <p className="text-xs text-text-muted">{doctor.clinic_name}, {doctor.city}</p>}
          <p className="text-xs text-text-secondary">
            Fee: PKR {doctor.consultation_fee_pkr.toLocaleString()} ·{" "}
            {doctor.accepts_online && doctor.accepts_walk_in ? "Online & Walk-in" : doctor.accepts_online ? "Online only" : "Walk-in only"}
          </p>

          {bookingDoctorId !== doctor.id ? (
            <div className="flex items-center gap-2 pt-1">
              {doctor.presence.is_bookable ? (
                <button
                  onClick={() => openBooking(doctor)}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover"
                >
                  <Calendar className="h-3.5 w-3.5" /> Book Appointment
                </button>
              ) : notifiedIds.includes(doctor.id) ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary">
                  <Check className="h-3.5 w-3.5" /> We'll notify you
                </span>
              ) : (
                <>
                  <span className="text-xs text-text-muted">
                    {doctor.presence.next_available ? "Next available slot found" : "No upcoming slots"}
                  </span>
                  <button
                    onClick={() => notifyMe(doctor)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-text-primary"
                  >
                    <Bell className="h-3.5 w-3.5" /> Notify me
                  </button>
                </>
              )}
              {(doctor.whatsapp || doctor.phone) && (
                <a
                  href={`https://wa.me/${(doctor.whatsapp || doctor.phone).replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-text-primary"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-bg-surface shadow-card p-3">
              <div className="grid grid-cols-2 gap-2">
                <select value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-md border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent">
                  {nextAvailableDates(doctor.available_days).map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 rounded-md border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent" />
              </div>
              {doctor.accepts_online && doctor.accepts_walk_in && (
                <div className="flex gap-1 rounded-md border border-border bg-bg-elevated p-0.5 text-xs">
                  <button onClick={() => setType("online")} className={`flex-1 rounded px-2 py-1 ${type === "online" ? "bg-accent text-accent-fg" : "text-text-secondary"}`}>Online</button>
                  <button onClick={() => setType("walk_in")} className={`flex-1 rounded px-2 py-1 ${type === "walk_in" ? "bg-accent text-accent-fg" : "text-text-secondary"}`}>Walk-in</button>
                </div>
              )}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent" />
              <div className="grid grid-cols-2 gap-2">
                <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent" />
                <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className="h-9 rounded-md border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus-visible:border-accent">
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone — e.g. +92 300 1234567" className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent" />
              <input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Known allergies (comma separated, optional)" className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent" />
              <input value={medications} onChange={(e) => setMedications(e.target.value)} placeholder="Current medications (comma separated, optional)" className="h-9 rounded-md border border-border bg-bg-elevated px-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent" />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => confirmBooking(doctor)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirm Booking
                </button>
                <button onClick={() => setBookingDoctorId(null)} className="text-xs text-text-secondary hover:text-text-primary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
