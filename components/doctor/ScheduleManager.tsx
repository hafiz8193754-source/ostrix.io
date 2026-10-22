"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_LABELS, SLOT_DURATIONS } from "@/components/doctor/registration/types";
import type { AvailabilityException, DoctorSchedule } from "@/types";

interface ScheduleManagerProps {
  accessToken: string;
}

interface EditableRow {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
  consultation_type: "online" | "walk_in" | "both";
  slot_duration_minutes: number;
}

function emptyRows(): EditableRow[] {
  return DAY_LABELS.map((_, i) => ({
    day_of_week: i,
    enabled: false,
    start_time: "09:00",
    end_time: "17:00",
    consultation_type: "both",
    slot_duration_minutes: 20,
  }));
}

function next14DaysPreview(rows: EditableRow[], exceptions: AvailabilityException[]) {
  const days: { key: string; label: string; available: boolean }[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const exception = exceptions.find((e) => e.exception_date === key);
    const available = exception ? exception.is_available : rows[d.getDay()]?.enabled ?? false;
    days.push({ key, label: d.toLocaleDateString("en-PK", { weekday: "short", day: "numeric" }), available });
  }
  return days;
}

export function ScheduleManager({ accessToken }: ScheduleManagerProps) {
  const [rows, setRows] = useState<EditableRow[]>(emptyRows());
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionAvailable, setExceptionAvailable] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/doctor/schedule", { headers: { authorization: `Bearer ${accessToken}` } });
    if (res.ok) {
      const data = await res.json();
      const schedule = (data.schedule || []) as DoctorSchedule[];
      const next = emptyRows();
      schedule.forEach((s) => {
        next[s.day_of_week] = {
          day_of_week: s.day_of_week,
          enabled: true,
          start_time: s.start_time.slice(0, 5),
          end_time: s.end_time.slice(0, 5),
          consultation_type: s.consultation_type,
          slot_duration_minutes: s.slot_duration_minutes,
        };
      });
      setRows(next);
      setExceptions(data.exceptions || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function updateRow(i: number, patch: Partial<EditableRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    setSavedMsg(false);
    const schedule = rows
      .filter((r) => r.enabled)
      .map((r) => ({
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        consultation_type: r.consultation_type,
        slot_duration_minutes: r.slot_duration_minutes,
      }));
    const res = await fetch("/api/doctor/schedule", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ schedule }),
    });
    if (res.ok) setSavedMsg(true);
    setSaving(false);
  }

  async function addException() {
    if (!exceptionDate) return;
    const res = await fetch("/api/doctor/schedule/exceptions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ exception_date: exceptionDate, is_available: exceptionAvailable, reason: exceptionReason }),
    });
    if (res.ok) {
      setExceptionDate("");
      setExceptionReason("");
      load();
    }
  }

  async function removeException(date: string) {
    await fetch(`/api/doctor/schedule/exceptions?date=${date}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
    load();
  }

  if (loading) return <p className="text-sm text-text-muted">Loading schedule…</p>;

  const preview = next14DaysPreview(rows, exceptions);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div
            key={row.day_of_week}
            className={cn(
              "grid grid-cols-[56px_1fr_1fr_1fr_1fr] items-center gap-2 rounded-lg border px-3 py-2",
              row.enabled ? "border-border bg-bg-elevated" : "border-border-subtle bg-bg-base opacity-60"
            )}
          >
            <label className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
              <input type="checkbox" checked={row.enabled} onChange={(e) => updateRow(i, { enabled: e.target.checked })} className="accent-accent" />
              {DAY_LABELS[row.day_of_week]}
            </label>
            <input
              type="time"
              disabled={!row.enabled}
              value={row.start_time}
              onChange={(e) => updateRow(i, { start_time: e.target.value })}
              className="h-8 rounded-md border border-border bg-bg-surface px-2 text-xs text-text-primary outline-none disabled:opacity-50"
            />
            <input
              type="time"
              disabled={!row.enabled}
              value={row.end_time}
              onChange={(e) => updateRow(i, { end_time: e.target.value })}
              className="h-8 rounded-md border border-border bg-bg-surface px-2 text-xs text-text-primary outline-none disabled:opacity-50"
            />
            <select
              disabled={!row.enabled}
              value={row.consultation_type}
              onChange={(e) => updateRow(i, { consultation_type: e.target.value as EditableRow["consultation_type"] })}
              className="h-8 rounded-md border border-border bg-bg-surface px-1.5 text-xs text-text-primary outline-none disabled:opacity-50"
            >
              <option value="both">Online + Walk-in</option>
              <option value="online">Online only</option>
              <option value="walk_in">Walk-in only</option>
            </select>
            <select
              disabled={!row.enabled}
              value={row.slot_duration_minutes}
              onChange={(e) => updateRow(i, { slot_duration_minutes: Number(e.target.value) })}
              className="h-8 rounded-md border border-border bg-bg-surface px-1.5 text-xs text-text-primary outline-none disabled:opacity-50"
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

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-black disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save schedule
        </button>
        {savedMsg && <span className="text-xs text-emerald-600">Saved.</span>}
      </div>

      <div className="rounded-lg border border-border bg-bg-elevated p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Next 14 days</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {preview.map((d) => (
            <div
              key={d.key}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px]",
                d.available ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-border bg-bg-surface text-text-muted"
              )}
            >
              <span>{d.label}</span>
              <span className={cn("h-1.5 w-1.5 rounded-full", d.available ? "bg-emerald-500" : "bg-neutral-400")} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg-elevated p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Exceptions (leave days / extra clinics)</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Date
            <input
              type="date"
              value={exceptionDate}
              onChange={(e) => setExceptionDate(e.target.value)}
              className="h-8 rounded-md border border-border bg-bg-surface px-2 text-xs text-text-primary outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input type="checkbox" checked={exceptionAvailable} onChange={(e) => setExceptionAvailable(e.target.checked)} className="accent-accent" />
            Available (extra clinic day)
          </label>
          <input
            value={exceptionReason}
            onChange={(e) => setExceptionReason(e.target.value)}
            placeholder="Reason (optional)"
            className="h-8 flex-1 rounded-md border border-border bg-bg-surface px-2 text-xs text-text-primary outline-none"
          />
          <button onClick={addException} disabled={!exceptionDate} className="h-8 rounded-md bg-accent px-3 text-xs font-medium text-black disabled:opacity-50">
            Add
          </button>
        </div>
        {exceptions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {exceptions.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between rounded-md bg-bg-surface px-2.5 py-1.5 text-xs">
                <span className="text-text-primary">
                  {ex.exception_date} — {ex.is_available ? "Extra availability" : "Leave"}
                  {ex.reason ? ` (${ex.reason})` : ""}
                </span>
                <button onClick={() => removeException(ex.exception_date)} className="text-text-muted hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
