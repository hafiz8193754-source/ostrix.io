"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { ArrowRight, Receipt, ShieldCheck, Stethoscope } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { DoctorVerificationPanel } from "@/components/admin/DoctorVerificationPanel";
import { PaymentsPanel } from "@/components/admin/PaymentsPanel";
import { Segmented, Skeleton } from "@/components/admin/ui";

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
  if (!session || authorized === null)
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8" role="status" aria-label="Loading admin dashboard">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-72" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>
    );

  const meta = session.user.user_metadata || {};
  const name = String(meta.full_name || meta.name || session.user.email?.split("@")[0] || "Admin").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const cards = [
    {
      id: "doctors" as Tab,
      label: "Doctors awaiting verification",
      cta: "Review doctors",
      value: summary?.pendingDoctors ?? 0,
      icon: Stethoscope,
      tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      bar: "bg-sky-500",
    },
    {
      id: "payments" as Tab,
      label: "Payment receipts to check",
      cta: "Review payments",
      value: summary?.pendingPayments ?? 0,
      icon: Receipt,
      tint: "bg-accent-glow text-accent",
      bar: "bg-accent",
    },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-bg-base/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Ostrix home">
            <OstrixLogo size="sm" withWordmark />
          </a>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            <ShieldCheck className="h-3 w-3 text-accent" /> Admin
          </span>
          <span className="ml-auto hidden truncate text-xs text-text-muted sm:block">{session.user.email}</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{today}</p>
          <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">Admin dashboard</h1>
          <p className="text-sm text-text-secondary">
            {greeting}, <span className="font-medium capitalize text-text-primary">{name}</span>. Here&apos;s what needs your attention.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {cards.map((c) => {
            const active = tab === c.id;
            return (
              <button
                key={c.id}
                data-testid={`summary-${c.id}`}
                onClick={() => selectTab(c.id)}
                aria-pressed={active}
                className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-bg-surface p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-5 ${
                  active ? "border-accent" : "border-border"
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${c.bar} ${active ? "opacity-100" : "opacity-40"}`} aria-hidden />
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.tint}`}>
                  <c.icon className="h-6 w-6" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs font-medium text-text-secondary">{c.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold tabular-nums text-text-primary">{c.value}</span>
                    <span className="text-xs text-text-muted">pending</span>
                  </span>
                </span>
                <span className="hidden items-center gap-1 text-xs font-medium text-accent sm:flex">
                  {c.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
                <ArrowRight className="h-4 w-4 text-text-muted sm:hidden" aria-hidden />
              </button>
            );
          })}
        </div>

        <Segmented
          label="Admin sections"
          size="md"
          items={TABS.map((t) => ({ id: t.id, label: t.label, count: t.id === "doctors" ? summary?.pendingDoctors ?? 0 : summary?.pendingPayments ?? 0 }))}
          value={tab}
          onChange={selectTab}
        />

        <div role="tabpanel" aria-label={tab === "doctors" ? "Doctors" : "Payments"}>
          {tab === "doctors" ? (
            <DoctorVerificationPanel session={session} onUnauthorized={unauthorized} onCountsChange={onDoctorCounts} />
          ) : (
            <PaymentsPanel session={session} onUnauthorized={unauthorized} onCountsChange={onPaymentCounts} />
          )}
        </div>
      </main>
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
