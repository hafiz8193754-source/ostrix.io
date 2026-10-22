"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor, ManualStatusOverride } from "@/types";

interface PresenceWidgetProps {
  doctor: Doctor;
  accessToken: string;
  onUpdated: (doctor: Doctor) => void;
}

const STATUS_META: Record<string, { label: string; dot: string }> = {
  available: { label: "You are Available", dot: "bg-emerald-500" },
  busy: { label: "You are In Consultation", dot: "bg-amber-500" },
  on_break: { label: "You are On Break", dot: "bg-amber-500" },
  do_not_disturb: { label: "Do Not Disturb", dot: "bg-red-500" },
  offline: { label: "You are Offline", dot: "bg-neutral-400" },
};

const BUTTONS: { status: ManualStatusOverride; label: string }[] = [
  { status: "available", label: "Available" },
  { status: "busy", label: "Busy" },
  { status: "on_break", label: "Break" },
  { status: "do_not_disturb", label: "DND" },
];

export function PresenceWidget({ doctor, accessToken, onUpdated }: PresenceWidgetProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function setStatus(status?: ManualStatusOverride, reset?: boolean) {
    setLoading(status || "reset");
    try {
      const res = await fetch("/api/doctor/presence/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(reset ? { reset_override: true } : { status }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdated({
          ...doctor,
          availability_status: data.availability_status,
          manual_status_override: reset ? null : status || doctor.manual_status_override,
          is_online: true,
        });
      }
    } catch {
      // best-effort
    }
    setLoading(null);
  }

  const meta = STATUS_META[doctor.availability_status] || STATUS_META.offline;
  const overrideActive =
    !!doctor.manual_status_override && !!doctor.override_expires_at && new Date(doctor.override_expires_at) > new Date();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
        <p className="text-sm font-medium text-text-primary">{meta.label}</p>
      </div>
      {doctor.available_hours_start && doctor.available_hours_end && (
        <p className="text-xs text-text-muted">
          Clinic hours: {doctor.available_hours_start.slice(0, 5)} – {doctor.available_hours_end.slice(0, 5)}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {BUTTONS.map((b) => (
          <button
            key={b.status}
            onClick={() => setStatus(b.status)}
            disabled={!!loading}
            className={cn(
              "flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50",
              doctor.manual_status_override === b.status && overrideActive
                ? "border-accent bg-accent-glow text-accent"
                : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
            )}
          >
            {loading === b.status && <Loader2 className="h-3 w-3 animate-spin" />}
            {b.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-text-muted">Auto-status follows your schedule. Manual status resets after 4 hours.</p>
      {overrideActive && (
        <button
          onClick={() => setStatus(undefined, true)}
          disabled={!!loading}
          className="self-start text-xs font-medium text-accent hover:underline"
        >
          Reset to automatic
        </button>
      )}
    </div>
  );
}
