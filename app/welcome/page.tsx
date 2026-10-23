"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, Stethoscope, ArrowRight } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { safeNext } from "@/lib/authRedirect";
import { OstrixLogo } from "@/components/brand/OstrixLogo";

type Choice = "patient" | "doctor";

export default function Welcome() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<Choice | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login?next=/welcome");
      const t = data.session.access_token;
      setToken(t);
      const res = await fetch("/api/account/role", { headers: { authorization: `Bearer ${t}` }, cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.role) {
        // Already has a role: honour an explicit ?next=, else the role's home.
        const raw = new URLSearchParams(window.location.search).get("next");
        return router.replace(raw ? safeNext(raw, j.destination) : j.destination);
      }
      setReady(true);
    })();
  }, [router]);

  async function choose(role: Choice) {
    if (!token) return;
    setBusy(role);
    setErr("");
    const res = await fetch("/api/account/role", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    const j = await res.json().catch(() => ({}));
    if ((res.ok || res.status === 409) && j.destination) return router.replace(j.destination);
    setBusy(null);
    setErr(j.error || "Something went wrong. Please try again.");
  }

  const options: { role: Choice; title: string; body: string; Icon: typeof HeartPulse }[] = [
    { role: "patient", title: "As a Patient", body: "Check symptoms, book a doctor and keep your care in one place.", Icon: HeartPulse },
    { role: "doctor", title: "As a Doctor", body: "Register your practice. Your profile goes live after admin verification.", Icon: Stethoscope },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-mesh px-5 py-10">
      <OstrixLogo size="sm" withWordmark />
      <main className="w-full max-w-xl">
        <h1 className="text-center font-display text-2xl font-bold text-text-primary">How will you use Ostrix?</h1>
        <p className="mt-2 text-center text-sm text-text-secondary">Pick one to continue. You only need to do this once.</p>
        {!ready ? (
          <p className="mt-8 text-center text-sm text-text-secondary">One moment…</p>
        ) : (
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {options.map(({ role, title, body, Icon }) => (
              <button
                key={role}
                type="button"
                data-testid={`role-${role}`}
                disabled={busy !== null}
                onClick={() => choose(role)}
                className="group flex min-h-[150px] flex-col items-start gap-3 rounded-2xl border border-border bg-bg-surface/90 p-6 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="flex w-full items-center justify-between font-display text-lg font-bold text-text-primary">
                  {title}
                  <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="text-sm text-text-secondary">{busy === role ? "Saving…" : body}</span>
              </button>
            ))}
          </div>
        )}
        {err && <p className="mt-4 text-center text-sm text-red-400">{err}</p>}
      </main>
    </div>
  );
}
