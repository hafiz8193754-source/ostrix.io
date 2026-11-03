import { describe, expect, it } from "vitest";
import { isWithinWindow, reminderText } from "@/lib/reminders";

describe("reminders", () => {
  it("detects visits ~1 hour away in PKT", () => {
    const now = new Date("2026-11-02T04:00:00Z"); // 09:00 PKT
    expect(isWithinWindow("2026-11-02", "10:00:00", now)).toBe(true);
    expect(isWithinWindow("2026-11-02", "08:30:00", now)).toBe(false);
    expect(isWithinWindow("2026-11-02", "11:30:00", now)).toBe(false);
  });
  it("asks for payment on unpaid bookings", () => {
    expect(reminderText("booked", { date: "2026-11-02", time: "10:00", doctor: "Dr. Ali", fee: 1500, paid: false })).toContain("Pay PKR 1500");
  });
});
