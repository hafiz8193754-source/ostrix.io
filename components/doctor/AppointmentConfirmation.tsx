"use client";

import { useState } from "react";
import { CheckCircle2, PhoneCall, MessageCircle, Loader2 } from "lucide-react";
import type { Appointment, Doctor } from "@/types";

interface AppointmentConfirmationProps {
  appointment: Appointment;
  confirmationMessage: string;
  doctor: Doctor;
  accessToken: string;
}

export function AppointmentConfirmation({ appointment, confirmationMessage, doctor, accessToken }: AppointmentConfirmationProps) {
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState("");
  const [called, setCalled] = useState(false);

  async function startCall() {
    setCalling(true);
    setCallError("");
    try {
      const res = await fetch("/api/doctor/call", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ appointment_id: appointment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the call.");
      setCalled(true);
    } catch (e) {
      setCallError((e as Error).message);
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="flex max-w-[560px] flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="flex items-center gap-2 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
        <p className="text-sm font-semibold">Appointment Booked</p>
      </div>
      <p className="text-sm text-text-primary">{confirmationMessage}</p>

      <div className="rounded-xl border border-border bg-bg-surface p-3.5 text-sm">
        <p className="font-medium text-text-primary">Dr. {doctor.full_name} · {doctor.specialization.replace(/_/g, " ")}</p>
        <p className="text-text-secondary">
          {new Date(appointment.appointment_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at {appointment.appointment_time.slice(0, 5)}
        </p>
        <p className="text-xs text-text-muted">{appointment.type === "online" ? "Online consultation" : "Walk-in visit"}</p>
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-3.5">
        <div className="mb-2 flex items-center gap-2">
          <button
            onClick={startCall}
            disabled={calling || called}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-black disabled:opacity-60"
          >
            {calling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5" />}
            {called ? "Calling you now…" : calling ? "Starting call…" : "Start Call"}
          </button>
          {(doctor.whatsapp || doctor.phone) && (
            <a
              href={`https://wa.me/${(doctor.whatsapp || doctor.phone).replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:border-accent hover:text-text-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Chat with Doctor
            </a>
          )}
        </div>
        {callError && <p className="text-xs text-red-600">{callError}</p>}
        <p className="text-xs text-text-muted">
          {called
            ? "Your phone and the doctor's phone will both ring shortly, joining the same private call. You'll hear a short consent notice first."
            : "Tap to have both your phone and the doctor's phone ring into a private call — neither of you sees the other's real number."}
        </p>
      </div>
    </div>
  );
}
