import { afterEach, describe, expect, it } from "vitest";
import { isWithinWindow, reminderChannel, reminderText, reminderVariables, whatsappAddress } from "@/lib/reminders";

describe("reminders", () => {
  const saved = {
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  };
  afterEach(() => {
    for (const key of Object.keys(saved) as (keyof typeof saved)[]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("detects visits ~1 hour away in PKT", () => {
    const now = new Date("2026-11-02T04:00:00Z"); // 09:00 PKT
    expect(isWithinWindow("2026-11-02", "10:00:00", now)).toBe(true);
    expect(isWithinWindow("2026-11-02", "08:30:00", now)).toBe(false);
    expect(isWithinWindow("2026-11-02", "11:30:00", now)).toBe(false);
  });
  it("asks for payment on unpaid bookings", () => {
    expect(reminderText("booked", { date: "2026-11-02", time: "10:00", doctor: "Dr. Ali", fee: 1500, paid: false })).toContain("Pay PKR 1500");
  });
  it("prefers WhatsApp and falls back to SMS only when WhatsApp is unset", () => {
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+447700900000";
    process.env.TWILIO_PHONE_NUMBER = "+447700900001";
    expect(reminderChannel()).toBe("whatsapp");
    delete process.env.TWILIO_WHATSAPP_FROM;
    expect(reminderChannel()).toBe("sms");
    delete process.env.TWILIO_PHONE_NUMBER;
    expect(reminderChannel()).toBeNull();
  });
  it("fills the four template variables and addresses WhatsApp as whatsapp:+E164", () => {
    const variables = reminderVariables("one_hour", { date: "2026-11-02", time: "10:00:00", doctor: "Ali", fee: 0, paid: true });
    expect(variables["1"]).toContain("1 hour");
    expect(variables["2"]).toBe("Dr. Ali");
    expect(variables["3"]).toBe("2026-11-02 at 10:00");
    expect(variables["4"]).toContain("/my-care");
    expect(whatsappAddress("+447878268504")).toBe("whatsapp:+447878268504");
    expect(whatsappAddress("whatsapp:+447878268504")).toBe("whatsapp:+447878268504");
  });
});
