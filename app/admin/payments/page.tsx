"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { Landmark, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
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
export default function AdminPaymentsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [bank, setBank] = useState<BankDetails>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<Payment["status"]>("pending");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [counts, setCounts] = useState<Record<Payment["status"], number>>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setSession(data.session);
    });
  }, [router]);

  const headers = useCallback(
    () => ({ "content-type": "application/json", authorization: `Bearer ${session?.access_token || ""}` }),
    [session]
  );

  const loadPayments = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const res = await fetch(`/api/admin/payments?status=${tab}`, { headers: headers() });
    if (res.status === 403) {
      setAuthorized(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setPayments(data.payments || []);
    if (data.counts) setCounts(data.counts);
    setLoading(false);
  }, [session, tab, headers]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/admin/settings", { headers: headers() }).then(async (res) => {
      if (res.status === 403) return setAuthorized(false);
      setAuthorized(true);
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
  }, [session, headers]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (authorized === false) router.replace("/");
  }, [authorized, router]);

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

  if (authorized === false)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="font-display text-xl font-bold text-text-primary">Admins only</h1>
        <p className="text-sm text-text-secondary">This account doesn&apos;t have admin access.</p>
      </div>
    );
  if (session === undefined || authorized === null) return null;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <OstrixLogo size="sm" withWordmark />
        <span className="rounded-full border border-border bg-bg-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">Admin</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Payments</h1>
        <p className="mt-1 text-sm text-text-secondary">Bank transfer is the only payment method. Verify each transfer against your bank statement.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <section data-testid="bank-settings" className="flex flex-col gap-3 rounded-xl border border-border bg-bg-surface p-4">
          <h2 className="flex items-center gap-1.5 font-display text-base font-bold text-text-primary">
            <Landmark className="h-4 w-4" /> Bank account
          </h2>
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs text-text-secondary">
              {f.label}
              <input
                value={bank[f.key] || ""}
                onChange={(e) => setBank({ ...bank, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Instructions (optional)
            <textarea
              value={bank.bank_instructions || ""}
              onChange={(e) => setBank({ ...bank, bank_instructions: e.target.value })}
              rows={3}
              placeholder="e.g. Use your phone number as the transfer reference."
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <button onClick={saveBank} disabled={saving} className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-black disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save bank details
          </button>
          {saved && <p className="text-xs text-text-secondary">{saved}</p>}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
            {TABS.map((t) => (
              <button
                key={t.status}
                onClick={() => setTab(t.status)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                  tab === t.status ? "border-accent bg-accent-glow text-accent" : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label} ({counts[t.status]})
              </button>
            ))}
          </div>
          {loading && <p className="text-sm text-text-muted">Loading…</p>}
          {!loading && payments.length === 0 && <p className="text-sm text-text-muted">No payments in this queue.</p>}
          {!loading &&
            payments.map((p) => (
              <div key={p.id} data-testid="admin-payment" className="flex flex-col gap-2 rounded-xl border border-border bg-bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">{p.patient_name || "Patient"} → Dr. {(p.doctor_name || "").replace(/^dr\.?\s+/i, "")}</p>
                    <p className="text-xs text-text-muted">
                      {p.appointment_date} {p.appointment_time?.slice(0, 5)} · submitted {new Date(p.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-display font-bold text-text-primary">PKR {p.amount_pkr.toLocaleString()}</span>
                </div>
                <p className="text-xs text-text-secondary">
                  Reference: <span className="font-mono text-text-primary">{p.transfer_reference}</span>
                  {p.receipt_url ? (
                    <>
                      {" · "}
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-accent">
                        View receipt
                      </a>
                    </>
                  ) : (
                    " · no receipt"
                  )}
                </p>
                {p.admin_note && <p className="text-xs text-text-muted">Note: {p.admin_note}</p>}
                {p.status === "pending" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={notes[p.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                      placeholder="Note to patient (optional)"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                    />
                    <button onClick={() => review(p.id, "approve")} disabled={busyId === p.id} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-60">
                      Approve
                    </button>
                    <button onClick={() => review(p.id, "reject")} disabled={busyId === p.id} className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-60">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}
