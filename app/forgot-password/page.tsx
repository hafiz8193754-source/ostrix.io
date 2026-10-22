"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("Enter a valid email address.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Never reveal whether the account exists; only surface rate limits.
    if (error && /rate limit|too many|seconds/i.test(error.message)) {
      return setErr("Too many requests. Please wait a minute and try again.");
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg-base px-6">
      <OstrixLogo size="sm" withWordmark />
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-surface p-7">
        <h2 className="font-display text-lg font-bold text-text-primary">Reset your password</h2>
        {sent ? (
          <>
            <p className="mt-2 text-sm text-text-secondary">
              If an account exists for <span className="font-medium text-text-primary">{email.trim()}</span>, we&apos;ve
              sent a link to reset the password. Check your inbox and spam folder.
            </p>
            <a href="/login" className="mt-5 inline-block text-xs font-semibold text-accent">Back to sign in</a>
          </>
        ) : (
          <>
            <p className="mb-5 mt-1 text-xs text-text-secondary">Enter your email and we&apos;ll send you a reset link.</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              {err && <p className="text-xs text-red-400">{err}</p>}
              <Button type="submit" disabled={busy} className="w-full justify-center">
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <div className="mt-4 text-xs text-text-secondary">
              Remembered it? <a href="/login" className="font-semibold text-accent">Sign in</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
