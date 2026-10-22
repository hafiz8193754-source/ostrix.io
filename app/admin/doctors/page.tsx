"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { DoctorQueueCard } from "@/components/admin/DoctorQueueCard";
import { DoctorReviewPanel } from "@/components/admin/DoctorReviewPanel";
import type { Doctor, RegistrationStatus } from "@/types";

const TABS: { status: RegistrationStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "under_review", label: "Under Review" },
  { status: "verified", label: "Verified" },
  { status: "rejected", label: "Rejected" },
  { status: "suspended", label: "Suspended" },
];

export default function AdminDoctorsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<RegistrationStatus>("pending");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [counts, setCounts] = useState<Record<RegistrationStatus, number>>({
    pending: 0,
    under_review: 0,
    verified: 0,
    rejected: 0,
    suspended: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setSession(data.session);
    });
  }, [router]);

  const load = useCallback(
    async (status: RegistrationStatus) => {
      if (!session) return;
      setLoading(true);
      const res = await fetch(`/api/admin/doctors?status=${status}`, {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 403) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);
      const data = await res.json();
      setDoctors(data.doctors || []);
      setCounts(data.counts || counts);
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session]
  );

  useEffect(() => {
    load(tab);
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, session]);

  useEffect(() => {
    if (authorized === false) router.replace("/");
  }, [authorized, router]);

  function handleReviewed(updated: Doctor) {
    setDoctors((ds) => ds.filter((d) => d.id !== updated.id));
    setSelectedId(null);
    setCounts((c) => ({ ...c, [tab]: Math.max(0, c[tab] - 1) }));
  }

  if (session === undefined || authorized === null || authorized === false) return null;

  const selected = doctors.find((d) => d.id === selectedId) || null;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center gap-2">
        <OstrixLogo size="sm" withWordmark />
        <span className="rounded-full border border-border bg-bg-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">Admin</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Doctor verification</h1>
        <p className="mt-1 text-sm text-text-secondary">Verify PMDC registrations by hand — nothing here is automated.</p>
      </div>

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-2">
          {loading && <p className="text-sm text-text-muted">Loading…</p>}
          {!loading && doctors.length === 0 && <p className="text-sm text-text-muted">No doctors in this queue.</p>}
          {doctors.map((d) => (
            <DoctorQueueCard key={d.id} doctor={d} selected={d.id === selectedId} onSelect={() => setSelectedId(d.id)} />
          ))}
        </div>

        <div>
          {selected ? (
            <DoctorReviewPanel doctor={selected} accessToken={session?.access_token || ""} onReviewed={handleReviewed} />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-muted">
              Select a doctor from the list to review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
