"use client";

import { useState } from "react";
import { Copy, Landmark, Loader2, Upload } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import type { Appointment, BankDetails, Payment } from "@/types";

interface BankTransferPanelProps {
  appointment: Appointment;
  bank: BankDetails | null;
  lastPayment: Payment | null;
  accessToken: string;
  userId: string;
  onSubmitted: () => void;
}

// Bank Transfer is the only way to pay. Patient transfers the fee to the
// account below, then reports the reference (and optionally a receipt).
export function BankTransferPanel({ appointment, bank, lastPayment, accessToken, userId, onSubmitted }: BankTransferPanelProps) {
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const configured = Boolean(bank && (bank.bank_account_number || bank.bank_iban));
  const rows: [string, string | null | undefined][] = [
    ["Bank", bank?.bank_name],
    ["Account title", bank?.bank_account_title],
    ["Account number", bank?.bank_account_number],
    ["IBAN", bank?.bank_iban],
  ];

  if (appointment.payment_status === "pending")
    return (
      <div data-testid="payment-pending" className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-text-secondary">
        Bank transfer submitted{lastPayment ? ` (ref ${lastPayment.transfer_reference})` : ""}. We&apos;ll confirm once it&apos;s verified.
      </div>
    );

  async function submit() {
    setBusy(true);
    setError("");
    try {
      let receipt_path: string | null = null;
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Receipt must be under 5 MB.");
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        receipt_path = `${userId}/${appointment.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("payment-receipts").upload(receipt_path, file, { contentType: file.type || undefined });
        if (upErr) throw new Error("Could not upload the receipt.");
      }
      const res = await fetch("/api/patient/payments", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ appointment_id: appointment.id, transfer_reference: reference, receipt_path }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not submit your payment.");
      onSubmitted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="bank-transfer" className="flex flex-col gap-3 rounded-xl border border-border bg-bg-elevated p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium text-text-primary">
          <Landmark className="h-4 w-4" /> Pay by bank transfer
        </p>
        <span className="font-display font-bold text-text-primary">PKR {appointment.fee_pkr.toLocaleString()}</span>
      </div>

      {appointment.payment_status === "rejected" && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600">
          Your last transfer couldn&apos;t be verified{lastPayment?.admin_note ? `: ${lastPayment.admin_note}` : "."} Please check and submit again.
        </p>
      )}

      {configured ? (
        <dl className="grid grid-cols-1 gap-1.5 rounded-lg border border-border bg-bg-surface p-3 sm:grid-cols-[130px_1fr]">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-xs text-text-muted">{k}</dt>
              <dd className="flex items-center gap-1.5 break-all font-medium text-text-primary">
                {v}
                <button type="button" aria-label={`Copy ${k}`} onClick={() => navigator.clipboard?.writeText(String(v))} className="text-text-muted hover:text-text-primary">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p data-testid="bank-coming-soon" className="rounded-lg border border-dashed border-border bg-bg-surface p-3 text-center text-text-muted">
          Bank details coming soon
        </p>
      )}
      {bank?.bank_instructions && <p className="whitespace-pre-line text-xs text-text-secondary">{bank.bank_instructions}</p>}

      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        Transaction / reference number
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. FT2610221234"
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
        <Upload className="h-3.5 w-3.5" />
        <span>{file ? file.name : "Attach receipt (optional, image or PDF)"}</span>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || reference.trim().length < 3 || !configured}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-black disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} I&apos;ve paid — submit for verification
      </button>
    </div>
  );
}
