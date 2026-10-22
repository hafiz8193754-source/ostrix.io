"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const linkErr = params.get("error_description") || hash.get("error_description");
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    (async () => {
      if (linkErr) return setReady(false);
      const code = params.get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return setReady(true);
        await new Promise((r) => setTimeout(r, 150));
      }
      setReady((r) => r ?? false);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return setErr("Include at least one letter and one number.");
    if (pw !== pw2) return setErr("Passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
    setTimeout(() => router.replace("/studio"), 1800);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-mesh px-6 py-10">
      <OstrixLogo size="sm" withWordmark />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-surface/90 p-8 shadow-lift backdrop-blur">
        <h2 className="font-display text-lg font-bold text-text-primary">Set a new password</h2>
        {ready === null && <p className="mt-2 text-sm text-text-secondary">Checking your reset link…</p>}
        {ready === false && (
          <>
            <p className="mt-2 text-sm text-red-400">This reset link is invalid or has expired.</p>
            <a href="/forgot-password" className="mt-4 inline-block text-xs font-semibold text-accent">Request a new link</a>
          </>
        )}
        {ready && done && (
          <p className="mt-2 text-sm text-emerald-400">Password updated. Taking you to your account…</p>
        )}
        {ready && !done && (
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3" noValidate>
            <Input type="password" placeholder="New password (min 8, letters + numbers)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            <Input type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <Button type="submit" disabled={busy} className="w-full justify-center">
              {busy ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
