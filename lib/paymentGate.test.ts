import { describe, expect, it } from "vitest";
import { isPaymentCleared, paymentGateError, PAYMENT_PENDING_MESSAGE } from "./paymentGate";

describe("payment gate", () => {
  it("clears paid and not_required", () => {
    expect(isPaymentCleared("paid")).toBe(true);
    expect(isPaymentCleared("not_required")).toBe(true);
  });
  it.each(["unpaid", "pending", "rejected", null, undefined])("blocks %s", (s) => {
    expect(isPaymentCleared(s as string)).toBe(false);
    expect(paymentGateError({ payment_status: s as string }, "confirmed")).toEqual({ error: PAYMENT_PENDING_MESSAGE, status: 409 });
    expect(paymentGateError({ payment_status: s as string }, "in_progress")?.status).toBe(409);
  });
  it("allows confirm/start once paid", () => {
    expect(paymentGateError({ payment_status: "paid" }, "confirmed")).toBeNull();
    expect(paymentGateError({ payment_status: "not_required" }, "in_progress")).toBeNull();
  });
  it("never blocks cancel, complete or no_show", () => {
    for (const s of ["cancelled", "completed", "no_show"]) expect(paymentGateError({ payment_status: "unpaid" }, s)).toBeNull();
  });
});
