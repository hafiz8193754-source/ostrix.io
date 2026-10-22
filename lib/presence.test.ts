import { describe, expect, it } from "vitest";
import { computePresence, type PresenceDoctorInput, type PresenceScheduleInput, type PresenceExceptionInput } from "./presence";

function doctor(overrides: Partial<PresenceDoctorInput> = {}): PresenceDoctorInput {
  return {
    pmdc_verified: true,
    accepting_new_patients: true,
    last_seen_at: null,
    manual_status_override: null,
    override_expires_at: null,
    ...overrides,
  };
}

function schedule(overrides: Partial<PresenceScheduleInput> = {}): PresenceScheduleInput {
  return { day_of_week: 0, start_time: "09:00", end_time: "17:00", is_active: true, ...overrides };
}

// Wednesday 2026-07-22, 10:00 local time — falls within a 09:00-17:00 block
// on day_of_week 3.
const WED_10AM = new Date(2026, 6, 22, 10, 0, 0);
const WED_SCHEDULE: PresenceScheduleInput[] = [schedule({ day_of_week: 3, start_time: "09:00", end_time: "17:00" })];

describe("computePresence", () => {
  it("gate 1: unverified doctor is always offline/unbookable, even with a fresh heartbeat inside schedule hours", () => {
    const result = computePresence(
      doctor({ pmdc_verified: false, last_seen_at: WED_10AM.toISOString() }),
      WED_SCHEDULE,
      [],
      WED_10AM
    );
    expect(result.status).toBe("offline");
    expect(result.is_bookable).toBe(false);
  });

  it("not accepting new patients overrides bookability even while otherwise available", () => {
    const result = computePresence(
      doctor({ accepting_new_patients: false, last_seen_at: WED_10AM.toISOString() }),
      WED_SCHEDULE,
      [],
      WED_10AM
    );
    expect(result.is_bookable).toBe(false);
    expect(result.label).toBe("Not accepting new patients");
  });

  it("active manual override 'available' wins and is bookable", () => {
    const result = computePresence(
      doctor({
        manual_status_override: "available",
        override_expires_at: new Date(WED_10AM.getTime() + 60_000).toISOString(),
      }),
      [],
      [],
      WED_10AM
    );
    expect(result.status).toBe("available");
    expect(result.is_bookable).toBe(true);
  });

  it("active manual override 'busy' wins and is not bookable", () => {
    const result = computePresence(
      doctor({
        manual_status_override: "busy",
        override_expires_at: new Date(WED_10AM.getTime() + 60_000).toISOString(),
      }),
      WED_SCHEDULE,
      [],
      WED_10AM
    );
    expect(result.status).toBe("busy");
    expect(result.is_bookable).toBe(false);
  });

  it("expired manual override is ignored, falls through to schedule/heartbeat logic", () => {
    const result = computePresence(
      doctor({
        manual_status_override: "do_not_disturb",
        override_expires_at: new Date(WED_10AM.getTime() - 60_000).toISOString(), // already expired
      }),
      WED_SCHEDULE,
      [],
      WED_10AM
    );
    expect(result.status).not.toBe("do_not_disturb");
  });

  it("heartbeat fresh + within schedule -> available now", () => {
    const result = computePresence(doctor({ last_seen_at: WED_10AM.toISOString() }), WED_SCHEDULE, [], WED_10AM);
    expect(result.status).toBe("available");
    expect(result.label).toBe("Available now");
    expect(result.is_bookable).toBe(true);
  });

  it("heartbeat fresh + outside schedule -> available, labeled outside clinic hours", () => {
    const lateNight = new Date(2026, 6, 22, 22, 0, 0); // still Wednesday, after 17:00
    const result = computePresence(doctor({ last_seen_at: lateNight.toISOString() }), WED_SCHEDULE, [], lateNight);
    expect(result.status).toBe("available");
    expect(result.label).toBe("Online (outside clinic hours)");
    expect(result.is_bookable).toBe(true);
  });

  it("no heartbeat + within schedule -> available, labeled clinic hours", () => {
    const result = computePresence(doctor({ last_seen_at: null }), WED_SCHEDULE, [], WED_10AM);
    expect(result.status).toBe("available");
    expect(result.label).toBe("Clinic hours — book appointment");
    expect(result.is_bookable).toBe(true);
  });

  it("stale heartbeat (>2min) is treated the same as no heartbeat", () => {
    const staleSeen = new Date(WED_10AM.getTime() - 3 * 60 * 1000);
    const result = computePresence(doctor({ last_seen_at: staleSeen.toISOString() }), WED_SCHEDULE, [], WED_10AM);
    expect(result.label).toBe("Clinic hours — book appointment");
  });

  it("outside schedule + no heartbeat -> offline with a computed next_available", () => {
    const sundayMorning = new Date(2026, 6, 19, 6, 0, 0); // Sunday, before any Wed block
    const result = computePresence(doctor(), WED_SCHEDULE, [], sundayMorning);
    expect(result.status).toBe("offline");
    expect(result.next_available).not.toBeNull();
    expect(new Date(result.next_available as string).getDay()).toBe(3); // next Wednesday
  });

  it("today has a full-day-off exception and no heartbeat -> on leave today", () => {
    const exceptions: PresenceExceptionInput[] = [
      { exception_date: "2026-07-22", is_available: false, start_time: null, end_time: null },
    ];
    const result = computePresence(doctor(), WED_SCHEDULE, exceptions, WED_10AM);
    expect(result.status).toBe("offline");
    expect(result.label).toBe("On leave today");
  });

  it("today marked on leave but doctor manually came online anyway -> reads as online, not on leave", () => {
    const exceptions: PresenceExceptionInput[] = [
      { exception_date: "2026-07-22", is_available: false, start_time: null, end_time: null },
    ];
    const result = computePresence(doctor({ last_seen_at: WED_10AM.toISOString() }), WED_SCHEDULE, exceptions, WED_10AM);
    expect(result.status).toBe("available");
    expect(result.label).toBe("Online (outside clinic hours)");
  });

  it("exception adds an extra available day with explicit hours even with no regular schedule that day", () => {
    const exceptions: PresenceExceptionInput[] = [
      { exception_date: "2026-07-22", is_available: true, start_time: "12:00", end_time: "14:00" },
    ];
    const noon = new Date(2026, 6, 22, 12, 30, 0);
    const result = computePresence(doctor(), [], exceptions, noon);
    expect(result.status).toBe("available");
    expect(result.label).toBe("Clinic hours — book appointment");
  });

  it("midnight edge case: a late-evening block does not leak availability into the next calendar day", () => {
    // Tuesday 21:00-23:00 block; checking Wednesday 00:30 must NOT read as
    // within that block even though 00:30 < 23:00 numerically if compared
    // without resetting minutes-of-day per calendar day.
    const tuesdayNightSchedule: PresenceScheduleInput[] = [
      schedule({ day_of_week: 2, start_time: "21:00", end_time: "23:00" }),
    ];
    const justAfterMidnight = new Date(2026, 6, 22, 0, 30, 0); // Wednesday 00:30
    const result = computePresence(doctor(), tuesdayNightSchedule, [], justAfterMidnight);
    expect(result.status).toBe("offline");
  });

  it("midnight edge case: a block ending exactly at midnight-adjacent time is still found correctly as next_available", () => {
    const earlySchedule: PresenceScheduleInput[] = [schedule({ day_of_week: 3, start_time: "00:00", end_time: "01:00" })];
    const priorNight = new Date(2026, 6, 21, 23, 0, 0); // Tuesday 23:00, before Wednesday's 00:00 block
    const result = computePresence(doctor(), earlySchedule, [], priorNight);
    expect(result.next_available).not.toBeNull();
    const next = new Date(result.next_available as string);
    expect(next.getDay()).toBe(3);
    expect(next.getHours()).toBe(0);
  });
});
