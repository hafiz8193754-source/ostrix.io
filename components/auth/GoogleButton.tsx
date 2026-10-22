"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function GoogleButton({ next, label = "Continue with Google" }: { next: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setErr("");
    setBusy(true);
    // The authorize endpoint shows raw JSON if Google isn't enabled, so check first.
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key ?? "" } });
      const j = await r.json();
      if (j?.external && j.external.google === false) {
        setBusy(false);
        return setErr("Google sign-in isn't available yet. Please use email for now.");
      }
    } catch {
      /* fall through and let Supabase handle it */
    }
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setBusy(false);
      setErr(
        /provider is not enabled|Unsupported provider/i.test(error.message)
          ? "Google sign-in isn't available yet. Please use email for now."
          : error.message
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-bg-elevated text-sm font-medium text-text-primary transition-colors hover:border-accent disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
        </svg>
        {busy ? "Redirecting…" : label}
      </button>
      {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-text-muted">
      <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
    </div>
  );
}
