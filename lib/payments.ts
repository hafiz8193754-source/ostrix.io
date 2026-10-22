import type { SupabaseClient } from "@supabase/supabase-js";

import { createNotification } from "@/lib/notifications";
import type { BankDetails, Payment } from "@/types";

// Bank Transfer is the only payment method. The patient pays into the account
// stored in platform_settings (row id 1, edited at /admin/payments — no code
// change needed), reports the reference + optional receipt, and an admin
// approves or rejects. Approval marks the appointment paid + confirmed.

const BANK_FIELDS = "bank_name, bank_account_title, bank_account_number, bank_iban, bank_instructions";

export async function getBankDetails(db: SupabaseClient): Promise<BankDetails> {
  const { data } = await db.from("platform_settings").select(BANK_FIELDS).eq("id", 1).maybeSingle();
  return (data as BankDetails) || {
    bank_name: null,
    bank_account_title: null,
    bank_account_number: null,
    bank_iban: null,
    bank_instructions: null,
  };
}

export function hasBankDetails(b: BankDetails): boolean {
  return Boolean(b.bank_account_number || b.bank_iban);
}

export async function saveBankDetails(admin: SupabaseClient, userId: string, details: BankDetails): Promise<BankDetails | null> {
  const { data, error } = await admin
    .from("platform_settings")
    .upsert({ id: 1, ...details, updated_by: userId, updated_at: new Date().toISOString() })
    .select(BANK_FIELDS)
    .single();
  if (error) return null;
  return data as BankDetails;
}

export async function listOwnPayments(db: SupabaseClient, userId: string): Promise<Payment[]> {
  const { data } = await db.from("payments").select("*").eq("payer_user_id", userId).order("created_at", { ascending: false }).limit(100);
  return (data || []) as Payment[];
}

export type AdminPayment = Payment & {
  patient_name: string | null;
  doctor_name: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  receipt_url: string | null;
};

export async function listPaymentsForAdmin(admin: SupabaseClient, status: Payment["status"]): Promise<AdminPayment[]> {
  const { data } = await admin.from("payments").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100);
  const rows = (data || []) as Payment[];
  if (!rows.length) return [];
  const apptIds = Array.from(new Set(rows.map((p) => p.appointment_id)));
  const { data: appts } = await admin.from("appointments").select("id, doctor_id, patient_id, appointment_date, appointment_time").in("id", apptIds);
  const doctorIds = Array.from(new Set((appts || []).map((a) => a.doctor_id)));
  const patientIds = Array.from(new Set(rows.map((p) => p.patient_id)));
  const [{ data: doctors }, { data: patients }] = await Promise.all([
    admin.from("doctors").select("id, full_name").in("id", doctorIds),
    admin.from("patients").select("id, full_name").in("id", patientIds),
  ]);
  return Promise.all(
    rows.map(async (p) => {
      const a = (appts || []).find((x) => x.id === p.appointment_id);
      let receipt_url: string | null = null;
      if (p.receipt_path) {
        const { data: signed } = await admin.storage.from("payment-receipts").createSignedUrl(p.receipt_path, 600);
        receipt_url = signed?.signedUrl || null;
      }
      return {
        ...p,
        patient_name: (patients || []).find((x) => x.id === p.patient_id)?.full_name || null,
        doctor_name: a ? (doctors || []).find((x) => x.id === a.doctor_id)?.full_name || null : null,
        appointment_date: a?.appointment_date || null,
        appointment_time: a?.appointment_time || null,
        receipt_url,
      };
    })
  );
}

export async function countPaymentsByStatus(admin: SupabaseClient): Promise<Record<Payment["status"], number>> {
  const statuses: Payment["status"][] = ["pending", "approved", "rejected"];
  const counts = await Promise.all(
    statuses.map((s) => admin.from("payments").select("id", { count: "exact", head: true }).eq("status", s))
  );
  return { pending: counts[0].count || 0, approved: counts[1].count || 0, rejected: counts[2].count || 0 };
}

export async function reviewPayment(
  admin: SupabaseClient,
  reviewerId: string,
  paymentId: string,
  action: "approve" | "reject",
  note?: string
): Promise<{ payment: Payment } | { error: string; status: number }> {
  const { data: payment } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) return { error: "Payment not found.", status: 404 };
  if (payment.status !== "pending") return { error: "This payment was already reviewed.", status: 409 };

  const approved = action === "approve";
  const { data: updated, error } = await admin
    .from("payments")
    .update({ status: approved ? "approved" : "rejected", admin_note: note || null, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error || !updated) return { error: "Could not update the payment.", status: 500 };

  const { data: appt } = await admin.from("appointments").select("id, status, doctor_id, appointment_date, appointment_time").eq("id", payment.appointment_id).maybeSingle();
  if (appt) {
    const patch: Record<string, string> = { payment_status: approved ? "paid" : "rejected", updated_at: new Date().toISOString() };
    if (approved && appt.status === "pending") patch.status = "confirmed";
    await admin.from("appointments").update(patch).eq("id", appt.id);
  }

  if (payment.payer_user_id) {
    try {
      await createNotification(
        admin,
        payment.payer_user_id,
        approved ? "payment_approved" : "payment_rejected",
        approved ? "Payment received" : "Payment not verified",
        approved
          ? `Your bank transfer (ref ${payment.transfer_reference}) is confirmed${appt ? ` for ${appt.appointment_date} at ${String(appt.appointment_time).slice(0, 5)}` : ""}.`
          : `We couldn't verify your bank transfer (ref ${payment.transfer_reference}).${note ? ` ${note}` : ""} Please check and submit again.`,
        "/my-care"
      );
    } catch {
      // The review stands even if the notification fails.
    }
  }
  if (approved && appt?.doctor_id) {
    try {
      const { data: doc } = await admin.from("doctors").select("user_id").eq("id", appt.doctor_id).maybeSingle();
      if (doc?.user_id)
        await createNotification(
          admin,
          doc.user_id,
          "payment_approved",
          "Patient payment approved",
          `Payment for the visit on ${appt.appointment_date} at ${String(appt.appointment_time).slice(0, 5)} is approved. You can now start the visit.`,
          "/doctor/dashboard"
        );
    } catch {
      // The review stands even if the doctor can't be notified.
    }
  }
  return { payment: updated as Payment };
}
