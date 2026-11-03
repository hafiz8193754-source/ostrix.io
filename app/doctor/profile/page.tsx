"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { readPhoto } from "@/lib/image";
import { PublicHeader } from "@/components/booking/PublicHeader";
import { DoctorAvatar } from "@/components/booking/DoctorAvatar";
import { ScheduleManager } from "@/components/doctor/ScheduleManager";
import { SPECIALIZATIONS } from "@/components/doctor/registration/types";
import { doctorPhoto, type PublicDoctor } from "@/lib/publicDoctors";
import { doctorName } from "@/lib/doctorDisplay";

const field = "h-12 w-full min-w-0 rounded-xl border border-border bg-bg-elevated px-3 text-base text-text-primary outline-none focus-visible:border-accent";

type Editable = PublicDoctor & { registration_status: string };

export default function DoctorProfileEditPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [doctor, setDoctor] = useState<Editable | null>(null);
  const [form, setForm] = useState({ specialization: "", consultation_fee_pkr: "0", bio: "", avatar_url: "", accepts_online: true, accepts_walk_in: true });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login?next=/doctor/profile");
      else setSession(data.session);
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/doctor/profile", { headers: { authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        const d = j.doctor as Editable;
        setDoctor(d);
        setForm({
          specialization: d.specialization,
          consultation_fee_pkr: String(d.consultation_fee_pkr ?? 0),
          bio: d.bio || "",
          avatar_url: d.avatar_url || "",
          accepts_online: d.accepts_online,
          accepts_walk_in: d.accepts_walk_in,
        });
      })
      .catch((e) => setError((e as Error).message));
  }, [session]);

  async function save(extra?: Partial<typeof form>) {
    if (!session) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    const body = { ...form, ...extra, consultation_fee_pkr: Number((extra?.consultation_fee_pkr ?? form.consultation_fee_pkr) || 0) };
    const res = await fetch("/api/doctor/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Could not save.");
    else {
      setDoctor(j.doctor);
      setMsg("Profile saved.");
    }
    setSaving(false);
  }

  async function upload(file: File) {
    if (!session) return;
    setUploading(true);
    setError(null);
    try {
      const resized = await readPhoto(file, 400);
      const blob = await (await fetch(resized.preview)).blob();
      const path = `${session.user.id}/doctor-avatar.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
      setForm((f) => ({ ...f, avatar_url: url }));
      await save({ avatar_url: url });
    } catch (e) {
      setError(`Photo upload failed: ${(e as Error).message}. You can paste an https:// photo URL instead.`);
    }
    setUploading(false);
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <PublicHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
        <Link href="/doctor/dashboard" className="inline-flex min-h-[44px] items-center gap-1 self-start text-sm font-medium text-text-secondary">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">My public profile</h1>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {!doctor && !error && <Loader2 className="h-5 w-5 animate-spin text-text-muted" />}
        {doctor && (
          <>
            {doctor.registration_status !== "verified" && (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-text-primary">
                Your profile is hidden from patients until an admin approves your PMDC verification.
              </p>
            )}
            {doctor.registration_status === "verified" && (
              <Link href={`/doctors/${doctor.id}`} className="text-sm font-medium text-accent underline">View public profile</Link>
            )}
            <section className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-4">
              <div className="flex items-center gap-4">
                <DoctorAvatar name={doctor.full_name} url={doctorPhoto({ avatar_url: form.avatar_url || null, profile_photo_url: null })} className="h-20 w-20 text-2xl" />
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold text-text-primary">{doctorName(doctor.full_name)}</p>
                  <p className="text-sm text-text-muted">PMDC {doctor.pmdc_number}</p>
                  <label className="mt-2 inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-border px-4 text-sm font-medium text-text-primary">
                    {uploading ? "Uploading…" : "Upload photo"}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                  </label>
                </div>
              </div>
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                Photo URL (optional)
                <input className={field} value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                Specialty
                <select className={field} value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })}>
                  {SPECIALIZATIONS.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                Consultation fee (PKR)
                <input className={field} inputMode="numeric" value={form.consultation_fee_pkr} onChange={(e) => setForm({ ...form, consultation_fee_pkr: e.target.value.replace(/[^0-9]/g, "") })} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-text-secondary">
                About you
                <textarea className={`${field} h-28 py-2`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={1500} />
              </label>
              <div className="flex flex-wrap gap-4 text-sm text-text-primary">
                <label className="inline-flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={form.accepts_online} onChange={(e) => setForm({ ...form, accepts_online: e.target.checked })} /> Online visits</label>
                <label className="inline-flex min-h-[44px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={form.accepts_walk_in} onChange={(e) => setForm({ ...form, accepts_walk_in: e.target.checked })} /> Walk-in</label>
              </div>
              {msg && <p className="text-sm text-accent">{msg}</p>}
              <button onClick={() => save()} disabled={saving} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-semibold text-accent-fg disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save profile
              </button>
            </section>
            <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-4">
              <h2 className="font-display text-lg font-semibold text-text-primary">Weekly availability</h2>
              <p className="text-sm text-text-secondary">Patients can only book the slots generated from these hours.</p>
              {session && <ScheduleManager accessToken={session.access_token} />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
