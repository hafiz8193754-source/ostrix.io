import type { PaymentStatus } from "@/types";

// A doctor may not confirm or start a visit until the bank transfer is
// approved by an admin (payment_status "paid"), unless no fee is due.
export const PAYMENT_GATED_STATUSES = new Set(["confirmed", "in_progress"]);
export const PAYMENT_PENDING_MESSAGE =
  "Payment for this appointment hasn't been approved yet. You can confirm or start the visit once an admin approves the patient's bank transfer.";

export function isPaymentCleared(paymentStatus: PaymentStatus | string | null | undefined): boolean {
  return paymentStatus === "paid" || paymentStatus === "not_required";
}

export function paymentGateError(
  appointment: { payment_status?: PaymentStatus | string | null },
  nextStatus: string
): { error: string; status: 409 } | null {
  if (!PAYMENT_GATED_STATUSES.has(nextStatus)) return null;
  if (isPaymentCleared(appointment.payment_status)) return null;
  return { error: PAYMENT_PENDING_MESSAGE, status: 409 };
}
