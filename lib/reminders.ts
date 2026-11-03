import type { SupabaseClient } from "@supabase/supabase-js";

import { hasServiceRoleKey, requireServiceClient } from "@/lib/serverAuth";
import { twilioClient, twilioConfigured } from "@/lib/twilio";
import { normalizePhone, pkNowParts, toMinutes } from "@/lib/slots";

// Patient reminders over Twilio SMS (+ WhatsApp when TWILIO_WHATSAPP_FROM is set).
// NOTE: a Twilio *trial* account can only deliver to numbers verified in the
// Twilio console; other numbers fail and are logged as 'failed'.
export type ReminderKind = "booked" | "confirmed" | "one_hour";
type Channel = "sms" | "whatsapp";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://ostrix-io.vercel.app").replace(/\/$/, "");
}

function doctorTitle(name: string): string {
  return `Dr. ${name.replace(/^dr\.?\s+/i, "")}`;
}

export function reminderText(kind: ReminderKind, a: { date: string; time: string; doctor: string; fee: number; paid: boolean }): string {
  const when = `${a.date} at ${a.time.slice(0, 5)} (PKT)`;
  if (kind === "booked")
    return a.fee > 0 && !a.paid
      ? `Ostrix: booked with ${doctorTitle(a.doctor)} on ${when}. Pay PKR ${a.fee} by bank transfer in My care to confirm: ${appUrl()}/my-care`
      : `Ostrix: booked with ${doctorTitle(a.doctor)} on ${when}. ${appUrl()}/my-care`;
  if (kind === "confirmed") return `Ostrix: your visit with ${doctorTitle(a.doctor)} on ${when} is confirmed. ${appUrl()}/my-care`;
  return `Ostrix reminder: your visit with ${doctorTitle(a.doctor)} starts in about 1 hour (${when}). Join from ${appUrl()}/my-care`;
}

function channels(): Channel[] {
  return process.env.TWILIO_WHATSAPP_FROM ? ["sms", "whatsapp"] : ["sms"];
}

async function sendOne(channel: Channel, to: string, body: string): Promise<void> {
  const client = twilioClient();
  if (channel === "sms") {
    await client.messages.create({ to, from: process.env.TWILIO_PHONE_NUMBER || "", body });
  } else {
    const from = process.env.TWILIO_WHATSAPP_FROM || "";
    await client.messages.create({ to: `whatsapp:${to}`, from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`, body });
  }
}

// Sends one reminder kind for an appointment on every configured channel,
// at most once per (appointment, kind, channel). Never throws.
export async function sendAppointmentReminder(appointmentId: string, kind: ReminderKind, db?: SupabaseClient): Promise<{ sent: number; failed: number; skipped: number }> {
  const res = { sent: 0, failed: 0, skipped: 0 };
  try {
    if (!twilioConfigured() || (!db && !hasServiceRoleKey())) return res;
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
    const body = reminderText(kind, {
      date: appt.appointment_date,
      time: String(appt.appointment_time),
      doctor: doctor?.full_name || "your doctor",
      fee: appt.fee_pkr || 0,
      paid: appt.payment_status === "paid" || appt.payment_status === "not_required",
    });
    for (const channel of channels()) {
      // Claim the slot first so concurrent runs never double-send.
      const { error: claimErr } = await admin
        .from("appointment_reminders")
        .insert({ appointment_id: appointmentId, kind, channel, status: to ? "sent" : "skipped", error: to ? null : "no valid phone" });
      if (claimErr) continue; // already handled
      if (!to) {
        res.skipped++;
        continue;
      }
      try {
        await sendOne(channel, to, body);
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
