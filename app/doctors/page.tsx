"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Loader2, Search } from "lucide-react";

import { PublicHeader } from "@/components/booking/PublicHeader";
import { DoctorAvatar } from "@/components/booking/DoctorAvatar";
import { SPECIALIZATIONS } from "@/components/doctor/registration/types";
import { doctorName, specialtyLabel } from "@/lib/doctorDisplay";
import { doctorPhoto, type PublicDoctor } from "@/lib/publicDoctors";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<PublicDoctor[] | null>(null);
  const [specialty, setSpecialty] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("specialization");
    if (s) setSpecialty(s);
  }, []);

  useEffect(() => {
    setDoctors(null);
    const params = new URLSearchParams();
    if (specialty) params.set("specialization", specialty);
    fetch(`/api/doctors?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDoctors(j.doctors || []))
      .catch(() => setError("Could not load doctors. Please try again."));
  }, [specialty]);

  const shown = useMemo(
    () => (doctors || []).filter((d) => !q.trim() || `${d.full_name} ${d.city} ${d.clinic_name || ""}`.toLowerCase().includes(q.trim().toLowerCase())),
    [doctors, q]
  );

  return (
    <div className="min-h-screen bg-bg-base">
      <PublicHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">Find a doctor</h1>
          <p className="mt-1 text-base text-text-secondary">Every doctor listed is PMDC-verified by the Ostrix team.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="relative block">
            <span className="sr-only">Search by name or city</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or city"
              className="h-12 w-full rounded-xl border border-border bg-bg-surface pl-9 pr-3 text-base text-text-primary outline-none focus-visible:border-accent"
            />
          </label>
          <label className="block">
            <span className="sr-only">Specialty</span>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-bg-surface px-3 text-base text-text-primary outline-none focus-visible:border-accent"
            >
              <option value="">All specialties</option>
              {SPECIALIZATIONS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!doctors && !error && (
          <p className="flex items-center gap-2 text-sm text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading doctors…</p>
        )}
        {doctors && shown.length === 0 && (
          <div data-testid="doctors-empty" className="rounded-2xl border border-border bg-bg-surface p-6 text-base text-text-secondary">
            No verified doctors match yet. Try another specialty, or check back soon.
          </div>
        )}

        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="doctor-list">
          {shown.map((d) => (
            <li key={d.id}>
              <Link
                href={`/doctors/${d.id}`}
                className="flex min-w-0 gap-4 rounded-2xl border border-border bg-bg-surface p-4 transition-colors hover:border-accent"
              >
                <DoctorAvatar name={d.full_name} url={doctorPhoto(d)} className="h-16 w-16 text-lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-text-primary">
                    <span className="break-words">{doctorName(d.full_name)}</span>
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-accent"><BadgeCheck className="h-4 w-4" /> PMDC verified</span>
                  </p>
                  <p className="text-sm text-text-secondary">{specialtyLabel(d.specialization)} · {d.city}</p>
                  <p className="text-sm text-text-muted">PMDC {d.pmdc_number}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {d.consultation_fee_pkr > 0 ? `PKR ${d.consultation_fee_pkr.toLocaleString()}` : "Fee not listed"}
                    </span>
                    <span className="inline-flex min-h-[40px] items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg">View times</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
