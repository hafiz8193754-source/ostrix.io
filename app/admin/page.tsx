"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { Receipt, Stethoscope } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { DoctorVerificationPanel } from "@/components/admin/DoctorVerificationPanel";
import { PaymentsPanel } from "@/components/admin/PaymentsPanel";

type Tab = "doctors" | "payments";
const TABS: { id: Tab; label: string }[] = [
  { id: "doctors", label: "Doctors" },
  { id: "payments", label: "Payments" },
];

function AdminHub() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "payments" ? "payments" : "doctors";
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<{ pendingDoctors: number; pendingPayments: number } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace(`/login?next=${encodeURIComponent("/admin")}`);
      else setSession(data.session);
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/admin/summary", { headers: { authorization: `Bearer ${session.access_token}` } }).then(async (res) => {
      if (res.status === 403) return setAuthorized(false);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return setAuthorized(false);
      setAuthorized(true);
      setSummary(data);
    });
  }, [session]);

  const unauthorized = useCallback(() => setAuthorized(false), []);
  const onDoctorCounts = useCallback(
    (c: { pending: number }) => setSummary((s) => (s ? { ...s, pendingDoctors: c.pending } : s)),
    []
  );
  const onPaymentCounts = useCallback(
    (c: { pending: number }) => setSummary((s) => (s ? { ...s, pendingPayments: c.pending } : s)),
    []
  );

  function selectTab(t: Tab) {
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
  }

  if (authorized === false)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="font-display text-xl font-bold text-text-primary">Admins only</h1>
        <p className="text-sm text-text-secondary">This account doesn&apos;t have admin access.</p>
      </div>
    );
  if (!session || authorized === null) return null;

  const cards = [
    { id: "doctors" as Tab, label: "Pending doctors", value: summary?.pendingDoctors ?? 0, icon: Stethoscope },
    { id: "payments" as Tab, label: "Pending payment receipts", value: summary?.pendingPayments ?? 0, icon: Receipt },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <OstrixLogo size="sm" withWordmark />
        <span className="rounded-full border border-border bg-bg-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">Admin</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Admin dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Doctor verification and bank-transfer payments in one place.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <button
            key={c.id}
            data-testid={`summary-${c.id}`}
            onClick={() => selectTab(c.id)}
            className={`flex flex-col gap-1 rounded-xl border bg-bg-surface p-4 text-left transition-colors ${
              tab === c.id ? "border-accent" : "border-border hover:border-text-muted"
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <c.icon className="h-3.5 w-3.5" /> {c.label}
            </span>
            <span className="font-display text-2xl font-bold text-text-primary">{c.value}</span>
          </button>
        ))}
      </div>

      <div role="tablist" className="flex gap-1.5 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              tab === t.id ? "border-accent bg-accent-glow text-accent" : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "doctors" ? (
        <DoctorVerificationPanel session={session} onUnauthorized={unauthorized} onCountsChange={onDoctorCounts} />
      ) : (
        <PaymentsPanel session={session} onUnauthorized={unauthorized} onCountsChange={onPaymentCounts} />
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminHub />
    </Suspense>
  );
}
