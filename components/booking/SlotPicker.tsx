"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DaySlots } from "@/lib/slots";

interface SlotPickerProps {
  doctorId: string;
  value: { date: string; time: string } | null;
  onChange: (v: { date: string; time: string }) => void;
  initialDays?: DaySlots[];
  refreshKey?: number;
}

// Real available slots (doctor schedule − exceptions − already booked), PKT.
export function SlotPicker({ doctorId, value, onChange, initialDays, refreshKey = 0 }: SlotPickerProps) {
  const [days, setDays] = useState<DaySlots[] | null>(initialDays ?? null);
  const [activeDate, setActiveDate] = useState<string>(initialDays?.[0]?.date || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDays && refreshKey === 0) return;
    let cancelled = false;
    setError(null);
    fetch(`/api/doctors/${doctorId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) throw new Error(j.error);
        setDays(j.days || []);
        setActiveDate((cur) => (j.days?.some((d: DaySlots) => d.date === cur) ? cur : j.days?.[0]?.date || ""));
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [doctorId, refreshKey, initialDays]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!days)
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading available times…
      </p>
    );
  if (!days.length)
    return <p data-testid="no-slots" className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-text-secondary">No open time slots in the next 2 weeks.</p>;

  const active = days.find((d) => d.date === activeDate) || days[0];
  return (
    <div data-testid="slot-picker" className="flex min-w-0 flex-col gap-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Pick a date">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={d.date === active.date}
            onClick={() => setActiveDate(d.date)}
            className={cn(
              "flex min-h-[48px] shrink-0 flex-col items-center justify-center rounded-xl border px-3 text-sm",
              d.date === active.date ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-elevated text-text-primary"
            )}
          >
            <span className="font-semibold">{d.label}</span>
            <span className="text-xs opacity-80">{d.slots.length} open</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {active.slots.map((t) => {
          const selected = value?.date === active.date && value?.time === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ date: active.date, time: t })}
              aria-pressed={selected}
              className={cn(
                "min-h-[44px] rounded-lg border text-sm font-medium",
                selected ? "border-accent bg-accent text-accent-fg" : "border-border bg-bg-surface text-text-primary hover:border-accent"
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-muted">Times are Pakistan time (PKT). Booked times are hidden.</p>
    </div>
  );
}
