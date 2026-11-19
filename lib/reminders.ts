import type { SupabaseClient } from "@supabase/supabase-js";

import { hasServiceRoleKey, requireServiceClient } from "@/lib/serverAuth";
import { twilioClient } from "@/lib/twilio";
import { normalizePhone, pkNowParts, toMinutes } from "@/lib/slots";

// Appointment reminders go out on WhatsApp when TWILIO_WHATSAPP_FROM is set.
// SMS is used only when WhatsApp is not configured. A business-initiated
// WhatsApp message outside the 24-hour session needs an approved Content
// template: set TWILIO_WHATSAPP_REMINDER_CONTENT_SID to send that template.
// Without the SID we send the same text as a freeform body.
// A Twilio trial account can only deliver SMS to numbers verified in the console.
export type ReminderKind = "booked" | "confirmed" | "one_hour";
export type ReminderChannel = "sms" | "whatsapp";

// Approved-template body. Variables: 1 headline, 2 doctor, 3 date and time, 4 next step.
export const REMINDER_TEMPLATE = "Ostrix: {{1}} with {{2}} on {{3}} (PKT). {{4}}";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://ostrix-io.vercel.app").replace(/\/$/, "");
}

function doctorTitle(name: string): string {
  return `Dr. ${name.replace(/^dr\.?\s+/i, "")}`;
}

export type ReminderFacts = { date: string; time: string; doctor: string; fee: number; paid: boolean };

export function reminderVariables(kind: ReminderKind, a: ReminderFacts): Record<"1" | "2" | "3" | "4", string> {
  const when = `${a.date} at ${a.time.slice(0, 5)}`;
  const doctor = doctorTitle(a.doctor);
  const care = `${appUrl()}/my-care`;
  let headline = "Your visit is booked";
  let next = `Details: ${care}`;
  if (kind === "booked" && a.fee > 0 && !a.paid) next = `Pay PKR ${a.fee} by bank transfer in My care to confirm: ${care}`;
  if (kind === "confirmed") headline = "Your visit is confirmed";
  if (kind === "one_hour") {
    headline = "Your visit starts in about 1 hour";
    next = `Join from ${care}`;
  }
  return { "1": headline, "2": doctor, "3": when, "4": next };
}

export function reminderText(kind: ReminderKind, a: ReminderFacts): string {
  const v = reminderVariables(kind, a);
  return REMINDER_TEMPLATE.replace(/\{\{(\d)\}\}/g, (_, key: string) => v[key as "1"]);
}

export function whatsappAddress(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

// WhatsApp when a sender is configured. SMS only as the fallback.
export function reminderChannel(): ReminderChannel | null {
  if (process.env.TWILIO_WHATSAPP_FROM?.trim()) return "whatsapp";
  if (process.env.TWILIO_PHONE_NUMBER?.trim()) return "sms";
  return null;
}

function remindersConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && reminderChannel());
}

async function sendOne(channel: ReminderChannel, to: string, body: string, variables: Record<string, string>): Promise<void> {
  const client = twilioClient();
  if (channel === "sms") {
    await client.messages.create({ to, from: process.env.TWILIO_PHONE_NUMBER || "", body });
    return;
  }
  const from = whatsappAddress(process.env.TWILIO_WHATSAPP_FROM || "");
  const contentSid = process.env.TWILIO_WHATSAPP_REMINDER_CONTENT_SID?.trim();
  await client.messages.create(
    contentSid
      ? { to: whatsappAddress(to), from, contentSid, contentVariables: JSON.stringify(variables) }
      : { to: whatsappAddress(to), from, body }
  );
}

// Sends one reminder kind on WhatsApp, or on SMS when WhatsApp is not configured,
// at most once per (appointment, kind, channel). Never throws.
export async function sendAppointmentReminder(appointmentId: string, kind: ReminderKind, db?: SupabaseClient): Promise<{ sent: number; failed: number; skipped: number }> {
  const res = { sent: 0, failed: 0, skipped: 0 };
  try {
    if (!remindersConfigured() || (!db && !hasServiceRoleKey())) return res;
    const admin = db || requireServiceClient();
    const { data: appt } = await admin
      .from("appointments")
      .select("id, appointment_date, appointment_time, fee_pkr, payment_status, status, patient:patients(phone), doctor:doctors(full_name)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appt) return res;
    const patient = (Array.isArray(appt.patient) ? appt.patient[0] : appt.patient) as { phone: string | null } | null;
    const doctor = (Array.isArray(appt.doctor) ? appt.doctor[0] : appt.doctor) as { full_name: string } | null;
    const to = patient?.phone ? normalizePhone(patient.phone) : null;
    const facts: ReminderFacts = {
      date: appt.appointment_date,
      time: String(appt.appointment_time),
      doctor: doctor?.full_name || "your doctor",
      fee: appt.fee_pkr || 0,
      paid: appt.payment_status === "paid" || appt.payment_status === "not_required",
    };
    const body = reminderText(kind, facts);
    const channel = reminderChannel();
    if (!channel) return res;
    // Claim the slot first so concurrent runs never double-send.
    const { error: claimErr } = await admin
      .from("appointment_reminders")
      .insert({ appointment_id: appointmentId, kind, channel, status: to ? "sent" : "skipped", error: to ? null : "no valid phone" });
    if (claimErr || !to) {
      if (!claimErr) res.skipped++;
      return res;
    }
    try {
      await sendOne(channel, to, body, reminderVariables(kind, facts));
      res.sent++;
    } catch (e) {
      res.failed++;
      await admin
        .from("appointment_reminders")
        .update({ status: "failed", error: String((e as Error).message || e).slice(0, 300) })
        .eq("appointment_id", appointmentId)
        .eq("kind", kind)
        .eq("channel", channel);
    }
  } catch {
    // Reminders are best-effort; booking/confirmation flows never fail on them.
  }
  return res;
}

// Appointments starting within the next `windowMinutes` (PKT), confirmed.
export function isWithinWindow(date: string, time: string, now: Date, windowMinutes = 75): boolean {
  const { date: today, minutes } = pkNowParts(now);
  const t = toMinutes(time);
  const start = new Date(`${date}T00:00:00Z`).getTime() / 60000 + t;
  const cur = new Date(`${today}T00:00:00Z`).getTime() / 60000 + minutes;
  const diff = start - cur;
  return diff > 0 && diff <= windowMinutes;
}

export async function runReminderSweep(now: Date = new Date()) {
  const admin = requireServiceClient();
  const { date: today } = pkNowParts(now);
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const { data } = await admin
    .from("appointments")
    .select("id, appointment_date, appointment_time, status")
    .in("appointment_date", [today, tomorrow.toISOString().slice(0, 10)])
    .eq("status", "confirmed")
    .limit(500);
  const totals = { checked: 0, confirmed: 0, one_hour: 0, failed: 0 };
  for (const a of data || []) {
    totals.checked++;
    const c = await sendAppointmentReminder(a.id, "confirmed", admin);
    totals.confirmed += c.sent;
    totals.failed += c.failed;
    if (isWithinWindow(a.appointment_date, String(a.appointment_time), now)) {
      const r = await sendAppointmentReminder(a.id, "one_hour", admin);
      totals.one_hour += r.sent;
      totals.failed += r.failed;
    }
  }
  return totals;
}
