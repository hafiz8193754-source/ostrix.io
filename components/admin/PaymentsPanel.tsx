"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { CalendarClock, CheckCircle2, ExternalLink, Inbox, Landmark, Loader2, Receipt, XCircle } from "lucide-react";

import { CopyButton, EmptyState, InitialsAvatar, RowSkeletons, Segmented, StatusBadge } from "@/components/admin/ui";

import type { AdminPayment } from "@/lib/payments";
import type { BankDetails, Payment } from "@/types";

const TABS: { status: Payment["status"]; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

const FIELDS: { key: keyof BankDetails; label: string; placeholder: string }[] = [
  { key: "bank_name", label: "Bank name", placeholder: "e.g. Meezan Bank" },
  { key: "bank_account_title", label: "Account title", placeholder: "Name on the account" },
  { key: "bank_account_number", label: "Account number", placeholder: "Account number" },
  { key: "bank_iban", label: "IBAN", placeholder: "PK00XXXX0000000000000000" },
];

const EMPTY: BankDetails = { bank_name: "", bank_account_title: "", bank_account_number: "", bank_iban: "", bank_instructions: "" };

// Bank Transfer is the only payment method: edit the account patients pay
// into, and approve/reject the transfers they report.
type PanelProps = {
  session: SupabaseSession;
  onUnauthorized: () => void;
  onCountsChange?: (counts: Record<Payment["status"], number>) => void;
};

export function PaymentsPanel({ session, onUnauthorized, onCountsChange }: PanelProps) {
  const [bank, setBank] = useState<BankDetails>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<Payment["status"]>("pending");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [counts, setCounts] = useState<Record<Payment["status"], number>>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const headers = useCallback(
    () => ({ "content-type": "application/json", authorization: `Bearer ${session.access_token || ""}` }),
    [session]
  );

  const loadPayments = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const res = await fetch(`/api/admin/payments?status=${tab}`, { headers: headers() });
    if (res.status === 403) {
      onUnauthorized();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setPayments(data.payments || []);
    if (data.counts) {
      setCounts(data.counts);
      onCountsChange?.(data.counts);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab, headers]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/admin/settings", { headers: headers() }).then(async (res) => {
      if (res.status === 403) return onUnauthorized();
      const data = await res.json().catch(() => ({}));
      const b = data.bank || {};
      setBank({
        bank_name: b.bank_name || "",
        bank_account_title: b.bank_account_title || "",
        bank_account_number: b.bank_account_number || "",
        bank_iban: b.bank_iban || "",
        bank_instructions: b.bank_instructions || "",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, headers]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  async function saveBank() {
    setSaving(true);
    setSaved("");
    const res = await fetch("/api/admin/settings", { method: "PUT", headers: headers(), body: JSON.stringify(bank) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setSaved(res.ok ? "Saved — patients see these details now." : data.error || "Could not save.");
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    await fetch(`/api/admin/payments/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ action, note: notes[id] || undefined }) });
    setBusyId(null);
    await loadPayments();
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent focus:bg-bg-surface";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-bold text-text-primary">Payments</h2>
        <p className="mt-0.5 text-sm text-text-secondary">Bank transfer is the only payment method. Verify each transfer against your bank statement.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="receipts-heading" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="receipts-heading" className="flex items-center gap-1.5 font-display text-sm font-bold text-text-primary">
              <Receipt className="h-4 w-4 text-accent" /> Payment receipts
            </h3>
          </div>
          <Segmented
            label="Payment status"
            items={TABS.map((t) => ({ id: t.status, label: t.label, count: counts[t.status] }))}
            value={tab}
            onChange={setTab}
          />
          <div className="flex flex-col gap-2.5" aria-live="polite">
            {loading && <RowSkeletons rows={3} />}
            {!loading && payments.length === 0 && (
              <EmptyState
                icon={Inbox}
                title={tab === "pending" ? "No receipts waiting" : "No payments in this queue"}
                hint={tab === "pending" ? "You're all caught up. New transfer receipts from patients show up here." : undefined}
              />
            )}
            {!loading &&
              payments.map((p) => (
                <article key={p.id} data-testid="admin-payment" className="flex flex-col gap-3 rounded-xl border border-border bg-bg-surface p-4 text-sm shadow-sm">
                  <div className="flex items-start gap-3">
                    <InitialsAvatar name={p.patient_name || "Patient"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-text-primary">{p.patient_name || "Patient"}</p>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="truncate text-xs text-text-secondary">to Dr. {(p.doctor_name || "").replace(/^dr\.?\s+/i, "")}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
                        <CalendarClock className="h-3 w-3" />
                        {p.appointment_date} {p.appointment_time?.slice(0, 5)} · submitted {new Date(p.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-base font-bold tabular-nums text-text-primary">PKR {p.amount_pkr.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-bg-elevated px-3 py-2 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      Reference <span className="font-mono font-semibold text-text-primary">{p.transfer_reference}</span>
                      <CopyButton value={p.transfer_reference} label="transfer reference" />
                    </span>
                    {p.receipt_url ? (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                        <ExternalLink className="h-3 w-3" /> View receipt
                      </a>
                    ) : (
                      <span className="text-text-muted">No receipt uploaded</span>
                    )}
                  </div>
                  {p.admin_note && <p className="text-xs text-text-muted">Note: {p.admin_note}</p>}
                  {p.status === "pending" && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label className="sr-only" htmlFor={`note-${p.id}`}>Note to patient</label>
                      <input
                        id={`note-${p.id}`}
                        value={notes[p.id] || ""}
                        onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                        placeholder="Note to patient (optional)"
                        className={`${inputCls} min-w-0 flex-1 py-1.5 text-xs`}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => review(p.id, "approve")}
                          disabled={busyId === p.id}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:flex-none"
                        >
                          {busyId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Approve
                        </button>
                        <button
                          onClick={() => review(p.id, "reject")}
                          disabled={busyId === p.id}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/40 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-500/5 disabled:opacity-60 sm:flex-none"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
          </div>
        </section>

        <section data-testid="bank-settings" aria-labelledby="bank-heading" className="flex h-fit flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-4 shadow-sm sm:p-5 lg:sticky lg:top-6">
          <div>
            <h3 id="bank-heading" className="flex items-center gap-1.5 font-display text-sm font-bold text-text-primary">
              <Landmark className="h-4 w-4 text-accent" /> Bank account
            </h3>
            <p className="mt-0.5 text-xs text-text-muted">Patients see these details when they pay.</p>
          </div>
          <div className="flex flex-col gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
                {f.label}
                <input value={bank[f.key] || ""} onChange={(e) => setBank({ ...bank, [f.key]: e.target.value })} placeholder={f.placeholder} className={inputCls} />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
              Instructions (optional)
              <textarea
                value={bank.bank_instructions || ""}
                onChange={(e) => setBank({ ...bank, bank_instructions: e.target.value })}
                rows={3}
                placeholder="e.g. Use your phone number as the transfer reference."
                className={`${inputCls} resize-none`}
              />
            </label>
          </div>
          <button
            onClick={saveBank}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-black hover:bg-accent-hover disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save bank details
          </button>
          {saved && (
            <p role="status" className="text-xs text-text-secondary">
              {saved}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
