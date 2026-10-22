"use client";

import { useState } from "react";
import { DAY_LABELS, SLOT_DURATIONS, type ScheduleRow, type StepProps } from "./types";
import { StepFooter } from "./StepFooter";
import { cn } from "@/lib/utils";

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function slotsForRow(row: ScheduleRow): number {
  if (!row.enabled) return 0;
  const span = toMinutes(row.end_time) - toMinutes(row.start_time);
  return span > 0 ? Math.floor(span / row.slot_duration_minutes) : 0;
}

export function StepSchedule({ values, onChange, onNext, onBack }: StepProps) {
  const [error, setError] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<ScheduleRow>) {
    onChange({ schedule: values.schedule.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }

  function copyMondayToWeekdays() {
    const monday = values.schedule[1]; // day_of_week 1 = Monday
    onChange({
      schedule: values.schedule.map((r, idx) => (idx >= 1 && idx <= 5 ? { ...monday, day_of_week: idx } : r)),
    });
  }

  const enabledRows = values.schedule.filter((r) => r.enabled);
  const dailySlots = enabledRows.map((r) => ({ row: r, slots: slotsForRow(r) }));
  const weeklySlots = dailySlots.reduce((sum, d) => sum + d.slots, 0);
  const perDayMax = dailySlots.length ? Math.max(...dailySlots.map((d) => d.slots)) : 0;

  const timeOrderValid = values.schedule.every((r) => !r.enabled || toMinutes(r.end_time) > toMinutes(r.start_time));
  const canContinue = enabledRows.length > 0 && timeOrderValid;

  function handleNext() {
    if (!enabledRows.length) {
      setError("Enable at least one day.");
      return;
    }
    if (!timeOrderValid) {
      setError("End time must be after start time for every enabled day.");
      return;
    }
    setError(null);
    onNext();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-text-primary">Weekly Schedule</h2>
        <button type="button" onClick={copyMondayToWeekdays} className="text-xs font-medium text-accent hover:underline">
          Copy Monday to all weekdays
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {values.schedule.map((row, i) => (
          <div
            key={row.day_of_week}
            className={cn(
              "grid grid-cols-[64px_1fr_1fr_1fr_1fr] items-center gap-2 rounded-lg border px-3 py-2",
              row.enabled ? "border-border bg-bg-elevated" : "border-border-subtle bg-bg-base opacity-60"
            )}
          >
            <label className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <input type="checkbox" checked={row.enabled} onChange={(e) => updateRow(i, { enabled: e.target.checked })} className="accent-accent" />
              {DAY_LABELS[row.day_of_week]}
            </label>
            <input
              type="time"
              disabled={!row.enabled}
              value={row.start_time}
              onChange={(e) => updateRow(i, { start_time: e.target.value })}
              className="h-8 rounded-md border border-border bg-bg-surface px-2 text-xs text-text-primary outline-none focus-visible:border-accent disabled:opacity-50"
            />
            <input
              type="time"
              disabled={!row.enabled}
              value={row.end_time}
              onChange={(e) => updateRow(i, { end_time: e.target.value })}
              className="h-8 rounded-md border border-border bg-bg-surface px-2 text-xs text-text-primary outline-none focus-visible:border-accent disabled:opacity-50"
            />
            <select
              disabled={!row.enabled}
              value={row.consultation_type}
              onChange={(e) => updateRow(i, { consultation_type: e.target.value as ScheduleRow["consultation_type"] })}
              className="h-8 rounded-md border border-border bg-bg-surface px-1.5 text-xs text-text-primary outline-none focus-visible:border-accent disabled:opacity-50"
            >
              <option value="both">Online + Walk-in</option>
              <option value="online">Online only</option>
              <option value="walk_in">Walk-in only</option>
            </select>
            <select
              disabled={!row.enabled}
              value={row.slot_duration_minutes}
              onChange={(e) => updateRow(i, { slot_duration_minutes: Number(e.target.value) })}
              className="h-8 rounded-md border border-border bg-bg-surface px-1.5 text-xs text-text-primary outline-none focus-visible:border-accent disabled:opacity-50"
            >
              {SLOT_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <p className="rounded-lg bg-accent-glow px-3 py-2 text-xs text-accent">
        This creates {perDayMax || 0} slots on your busiest day, {weeklySlots} slots per week.
      </p>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <StepFooter onBack={onBack} onNext={handleNext} canContinue={canContinue} nextLabel="Continue" />
    </div>
  );
}
