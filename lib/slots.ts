import type { AvailabilityException, DoctorSchedule } from "@/types";

// Real bookable slots from a doctor's weekly schedule + date exceptions,
// minus slots already booked. All dates/times are Pakistan clinic time.
export interface DaySlots {
  date: string; // YYYY-MM-DD
  label: string;
  slots: string[]; // HH:MM
}

export interface BookedSlot {
  appointment_date: string;
  appointment_time: string;
}

export const PK_TZ = "Asia/Karachi";

export function pkNowParts(now: Date = new Date()): { date: string; minutes: number } {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: PK_TZ }).format(now);
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: PK_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const [h, m] = hm.split(":").map(Number);
  return { date, minutes: (h % 24) * 60 + m };
}

export function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(n: number): string {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function generateSlots(opts: {
  schedules: Pick<DoctorSchedule, "day_of_week" | "start_time" | "end_time" | "slot_duration_minutes" | "is_active">[];
  exceptions?: Pick<AvailabilityException, "exception_date" | "is_available" | "start_time" | "end_time">[];
  booked?: BookedSlot[];
  days?: number;
  now?: Date;
  leadMinutes?: number;
}): DaySlots[] {
  const { schedules, exceptions = [], booked = [], days = 14, now = new Date(), leadMinutes = 30 } = opts;
  const { date: today, minutes: nowMin } = pkNowParts(now);
  const taken = new Set(booked.map((b) => `${b.appointment_date} ${b.appointment_time.slice(0, 5)}`));
  const out: DaySlots[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const exc = exceptions.find((e) => e.exception_date === date);
    const daySchedules = schedules.filter((s) => s.is_active !== false && s.day_of_week === dayOfWeek(date));
    let windows: { start: number; end: number; step: number }[] = daySchedules.map((s) => ({
      start: toMinutes(s.start_time),
      end: toMinutes(s.end_time),
      step: Math.max(5, s.slot_duration_minutes || 20),
    }));
    if (exc) {
      if (!exc.is_available) windows = [];
      else if (exc.start_time && exc.end_time)
        windows = [{ start: toMinutes(exc.start_time), end: toMinutes(exc.end_time), step: windows[0]?.step || 20 }];
    }
    const set = new Set<string>();
    for (const w of windows) {
      for (let t = w.start; t + w.step <= w.end; t += w.step) {
        if (i === 0 && t < nowMin + leadMinutes) continue;
        const hm = fromMinutes(t);
        if (!taken.has(`${date} ${hm}`)) set.add(hm);
      }
    }
    const slots = Array.from(set).sort();
    if (slots.length) out.push({ date, label: dayLabel(date), slots });
  }
  return out;
}

export function isSlotAvailable(days: DaySlots[], date: string, time: string): boolean {
  return days.some((d) => d.date === date && d.slots.includes(time.slice(0, 5)));
}

// Normalises a phone number to E.164. Pakistani local formats (03xx…, 92…)
// get +92; anything else must already carry a + country code.
export function normalizePhone(raw: string): string | null {
  const s = raw.replace(/[\s\-()]/g, "");
  let digits: string;
  if (s.startsWith("+")) digits = s.slice(1);
  else if (s.startsWith("00")) digits = s.slice(2);
  else if (/^03\d{9}$/.test(s)) digits = `92${s.slice(1)}`;
  else if (/^92\d{10}$/.test(s)) digits = s;
  else return null;
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
}
