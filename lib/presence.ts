// Computes a doctor's live availability from three inputs, in priority order:
// 1) an active manual override, 2) heartbeat freshness, 3) the weekly
// schedule/exceptions. Verification (pmdc_verified) is a hard gate above all
// three — an unverified doctor is always offline/unbookable here, no matter
// what presence data says. This function is pure (no DB/network access) so
// it can be unit-tested directly — see lib/presence.test.ts.

export type AvailabilityStatus = "available" | "busy" | "on_break" | "offline" | "do_not_disturb";

export interface PresenceResult {
  status: AvailabilityStatus;
  label: string;
  label_urdu: string;
  color: "green" | "amber" | "red" | "gray";
  is_bookable: boolean;
  next_available: string | null; // ISO datetime
}

export interface PresenceDoctorInput {
  pmdc_verified: boolean;
  accepting_new_patients: boolean;
  last_seen_at: string | null;
  manual_status_override: "available" | "busy" | "on_break" | "do_not_disturb" | null;
  override_expires_at: string | null;
}

export interface PresenceScheduleInput {
  day_of_week: number; // 0 = Sunday .. 6 = Saturday, matches Date#getDay()
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  is_active: boolean;
}

export interface PresenceExceptionInput {
  exception_date: string; // "YYYY-MM-DD", local calendar date
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

const HEARTBEAT_FRESH_MS = 2 * 60 * 1000;
const NEXT_AVAILABLE_SEARCH_DAYS = 14;

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function exceptionFor(exceptions: PresenceExceptionInput[], dateStr: string): PresenceExceptionInput | null {
  return exceptions.find((e) => e.exception_date === dateStr) || null;
}

// Compares time-of-day (minutes since midnight) only, never full Date
// arithmetic — a block near midnight can never leak into the wrong day.
function isWithinScheduleNow(schedules: PresenceScheduleInput[], exceptions: PresenceExceptionInput[], now: Date): boolean {
  const today = dateKey(now);
  const exception = exceptionFor(exceptions, today);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (exception) {
    if (!exception.is_available) return false;
    if (exception.start_time && exception.end_time) {
      return nowMin >= toMinutes(exception.start_time) && nowMin < toMinutes(exception.end_time);
    }
    return true; // available all day, no specific hours given
  }

  const day = now.getDay();
  return schedules.some(
    (s) => s.is_active && s.day_of_week === day && nowMin >= toMinutes(s.start_time) && nowMin < toMinutes(s.end_time)
  );
}

// Scans forward up to NEXT_AVAILABLE_SEARCH_DAYS for the next schedule block
// (or is_available exception), skipping full-day-off exceptions.
function computeNextAvailable(schedules: PresenceScheduleInput[], exceptions: PresenceExceptionInput[], now: Date): string | null {
  for (let offset = 0; offset <= NEXT_AVAILABLE_SEARCH_DAYS; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const key = dateKey(day);
    const exception = exceptionFor(exceptions, key);
    if (exception && !exception.is_available) continue;

    let starts: number[];
    if (exception && exception.is_available && exception.start_time) {
      starts = [toMinutes(exception.start_time)];
    } else if (!exception) {
      starts = schedules
        .filter((s) => s.is_active && s.day_of_week === day.getDay())
        .map((s) => toMinutes(s.start_time))
        .sort((a, b) => a - b);
    } else {
      starts = [];
    }

    for (const startMin of starts) {
      const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(startMin / 60), startMin % 60, 0, 0);
      if (offset === 0 && candidate <= now) continue; // already passed today
      return candidate.toISOString();
    }
  }
  return null;
}

function formatNext(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

const OVERRIDE_META: Record<
  Exclude<AvailabilityStatus, "offline">,
  { label: string; label_urdu: string; color: PresenceResult["color"] }
> = {
  available: { label: "Available now", label_urdu: "ابھی دستیاب ہے", color: "green" },
  busy: { label: "In consultation", label_urdu: "مشاورت میں مصروف ہے", color: "amber" },
  on_break: { label: "On break", label_urdu: "وقفے پر ہے", color: "amber" },
  do_not_disturb: { label: "Do not disturb", label_urdu: "ابھی رابطہ نہ کریں", color: "red" },
};

export function computePresence(
  doctor: PresenceDoctorInput,
  schedules: PresenceScheduleInput[],
  exceptions: PresenceExceptionInput[],
  now: Date
): PresenceResult {
  const offline = (label: string, label_urdu: string, next_available: string | null = null): PresenceResult => ({
    status: "offline",
    label,
    label_urdu,
    color: "gray",
    is_bookable: false,
    next_available,
  });

  // Gate 1 — verification always wins, above everything else.
  if (!doctor.pmdc_verified) return offline("Offline", "آف لائن");

  const notAccepting = doctor.accepting_new_patients === false;
  const gateAccepting = (result: PresenceResult): PresenceResult =>
    notAccepting ? { ...result, is_bookable: false, label: "Not accepting new patients" } : result;

  // Priority 1 — an active manual override beats heartbeat/schedule.
  const overrideActive =
    !!doctor.manual_status_override && !!doctor.override_expires_at && new Date(doctor.override_expires_at) > now;
  if (overrideActive && doctor.manual_status_override) {
    const meta = OVERRIDE_META[doctor.manual_status_override];
    const isAvailable = doctor.manual_status_override === "available";
    return gateAccepting({
      status: doctor.manual_status_override,
      label: meta.label,
      label_urdu: meta.label_urdu,
      color: meta.color,
      is_bookable: isAvailable,
      next_available: isAvailable ? null : computeNextAvailable(schedules, exceptions, now),
    });
  }

  const today = dateKey(now);
  const todayException = exceptionFor(exceptions, today);
  const onLeaveToday = !!todayException && !todayException.is_available;

  const heartbeatFresh =
    !!doctor.last_seen_at && now.getTime() - new Date(doctor.last_seen_at).getTime() < HEARTBEAT_FRESH_MS;
  const withinSchedule = !onLeaveToday && isWithinScheduleNow(schedules, exceptions, now);

  // Priority 3 (exception branch) — on leave today and not manually online.
  if (onLeaveToday && !heartbeatFresh) {
    return gateAccepting(offline("On leave today", "آج چھٹی پر ہے", computeNextAvailable(schedules, exceptions, now)));
  }

  // Priority 2 — heartbeat, cross-referenced with schedule for the label.
  if (heartbeatFresh && withinSchedule) {
    return gateAccepting({ status: "available", label: "Available now", label_urdu: "ابھی دستیاب ہے", color: "green", is_bookable: true, next_available: null });
  }
  if (heartbeatFresh && !withinSchedule) {
    return gateAccepting({
      status: "available",
      label: "Online (outside clinic hours)",
      label_urdu: "آن لائن (کلینک کے اوقات کے بعد)",
      color: "green",
      is_bookable: true,
      next_available: null,
    });
  }

  // Priority 3 — schedule alone, no live heartbeat.
  if (withinSchedule) {
    return gateAccepting({
      status: "available",
      label: "Clinic hours — book appointment",
      label_urdu: "کلینک کا وقت — اپائنٹمنٹ بک کریں",
      color: "green",
      is_bookable: true,
      next_available: null,
    });
  }

  const next = computeNextAvailable(schedules, exceptions, now);
  return gateAccepting(offline(next ? `Offline — next: ${formatNext(next)}` : "Offline", "آف لائن", next));
}
