import { describe, expect, it } from "vitest";
import { generateSlots, isSlotAvailable, normalizePhone } from "@/lib/slots";

// 2026-11-02 is a Monday. 04:00Z = 09:00 PKT.
const now = new Date("2026-11-02T04:00:00Z");
const mon = { day_of_week: 1, start_time: "10:00:00", end_time: "11:00:00", slot_duration_minutes: 20, is_active: true };

describe("generateSlots", () => {
  it("builds slots from the weekly schedule", () => {
    const days = generateSlots({ schedules: [mon], now, days: 8 });
    expect(days[0]).toMatchObject({ date: "2026-11-02", slots: ["10:00", "10:20", "10:40"] });
    expect(days[1].date).toBe("2026-11-09");
  });
  it("hides booked slots (no double booking)", () => {
    const days = generateSlots({ schedules: [mon], now, days: 1, booked: [{ appointment_date: "2026-11-02", appointment_time: "10:20:00" }] });
    expect(days[0].slots).toEqual(["10:00", "10:40"]);
    expect(isSlotAvailable(days, "2026-11-02", "10:20")).toBe(false);
    expect(isSlotAvailable(days, "2026-11-02", "10:40")).toBe(true);
  });
  it("hides past slots today and honours day-off exceptions", () => {
    const late = new Date("2026-11-02T05:15:00Z"); // 10:15 PKT
    expect(generateSlots({ schedules: [mon], now: late, days: 1 })).toEqual([]);
    const off = generateSlots({ schedules: [mon], now, days: 1, exceptions: [{ exception_date: "2026-11-02", is_available: false, start_time: null, end_time: null }] });
    expect(off).toEqual([]);
  });
});

describe("normalizePhone", () => {
  it("adds +92 to local Pakistani numbers and keeps E.164", () => {
    expect(normalizePhone("0300 1234567")).toBe("+923001234567");
    expect(normalizePhone("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizePhone("12345")).toBeNull();
  });
});
