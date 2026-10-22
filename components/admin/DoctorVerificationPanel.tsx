"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

import { MousePointerClick, UserCheck } from "lucide-react";

import { CopyButton, EmptyState, InitialsAvatar, RowSkeletons, Segmented, StatusBadge } from "@/components/admin/ui";
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

type PanelProps = {
  session: SupabaseSession;
  onUnauthorized: () => void;
  onCountsChange?: (counts: Record<RegistrationStatus, number>) => void;
};

// Doctor verification queue, rendered inside the /admin hub.
export function DoctorVerificationPanel({ session, onUnauthorized, onCountsChange }: PanelProps) {
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

  const load = useCallback(
    async (status: RegistrationStatus) => {
      if (!session) return;
      setLoading(true);
      const res = await fetch(`/api/admin/doctors?status=${status}`, {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 403) {
        setLoading(false);
        onUnauthorized();
        return;
      }
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
    onCountsChange?.(counts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]);

  function handleReviewed(updated: Doctor) {
    setDoctors((ds) => ds.filter((d) => d.id !== updated.id));
    setSelectedId(null);
    setCounts((c) => ({
      ...c,
      [tab]: Math.max(0, c[tab] - 1),
      [updated.registration_status]: (c[updated.registration_status] || 0) + (updated.registration_status === tab ? 0 : 1),
    }));
  }

  const selected = doctors.find((d) => d.id === selectedId) || null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-text-primary">Doctor verification</h2>
          <p className="mt-0.5 text-sm text-text-secondary">Verify PMDC registrations by hand — nothing here is automated.</p>
        </div>
      </div>

      <Segmented
        label="Doctor status"
        items={TABS.map((t) => ({ id: t.status, label: t.label, count: counts[t.status] }))}
        value={tab}
        onChange={setTab}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-2" aria-live="polite">
          {loading && <RowSkeletons rows={3} />}
          {!loading && doctors.length === 0 && (
            <EmptyState icon={UserCheck} title="No doctors in this queue" hint="New registrations will appear here as soon as doctors submit them." />
          )}
          {!loading &&
            doctors.map((d) => (
              <DoctorQueueCard key={d.id} doctor={d} selected={d.id === selectedId} onSelect={() => setSelectedId(d.id)} />
            ))}
        </div>

        <div className="min-w-0">
          {selected ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle pb-4">
                <InitialsAvatar name={selected.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-text-primary">{selected.full_name}</p>
                  <p className="text-xs capitalize text-text-secondary">
                    {selected.specialization.replace(/_/g, " ")}
                    {selected.city ? ` · ${selected.city}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-elevated py-1 pl-2.5 pr-1 font-mono text-xs font-semibold text-text-primary">
                    PMDC {selected.pmdc_number}
                    <CopyButton value={selected.pmdc_number} label="PMDC number" />
                  </span>
                  <StatusBadge status={selected.registration_status} />
                </div>
              </div>
              <DoctorReviewPanel doctor={selected} accessToken={session.access_token || ""} onReviewed={handleReviewed} />
            </div>
          ) : (
            <div className="hidden h-full min-h-[260px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-bg-surface text-center lg:flex">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
                <MousePointerClick className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-text-primary">Select a doctor to review</p>
              <p className="text-xs text-text-muted">Documents, checklist and actions open here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
