"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Appointment, DoctorSchedule } from "@/types";

interface TodaySlotsTimelineProps {
  accessToken: string;
  appointments: Appointment[];
}

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TodaySlotsTimeline({ accessToken, appointments }: TodaySlotsTimelineProps) {
  const [schedule, setSchedule] = useState<DoctorSchedule[] | null>(null);

  useEffect(() => {
    fetch("/api/doctor/schedule", { headers: { authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => setSchedule(d.schedule || []))
      .catch(() => setSchedule([]));
  }, [accessToken]);

  if (!schedule) return null;

  const today = new Date().getDay();
  const todayRows = schedule.filter((s) => s.day_of_week === today);
  if (!todayRows.length) return <p className="text-sm text-text-muted">No clinic hours scheduled today.</p>;

  const bookedTimes = new Set(appointments.map((a) => a.appointment_time.slice(0, 5)));
  const slots: { time: string; booked: boolean }[] = [];
  todayRows.forEach((row) => {
    const start = toMinutes(row.start_time.slice(0, 5));
    const end = toMinutes(row.end_time.slice(0, 5));
    for (let t = start; t < end; t += row.slot_duration_minutes) {
      const time = fromMinutes(t);
      slots.push({ time, booked: bookedTimes.has(time) });
    }
  });

  return (
    <div className="flex flex-wrap gap-1.5">
      {slots.map((s) => (
        <span
          key={s.time}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px] font-medium",
            s.booked ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          )}
        >
          {s.time} {s.booked ? "· booked" : "· free"}
        </span>
      ))}
    </div>
  );
}
