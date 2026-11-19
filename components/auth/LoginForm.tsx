"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { supabase } from "@/lib/supabaseClient";
import { BRAND } from "@/lib/brand";
import { authSchema, type AuthInput } from "@/lib/schemas";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/authRedirect";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";
import { useAuthSession } from "@/lib/useAuthSession";

// Google sign-in is off until the Google provider is configured in Supabase.
// Flip to true (or set NEXT_PUBLIC_GOOGLE_LOGIN=1) to show the button again.
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

function sameSiteNext(): string {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

function welcomePath(): string {
  const raw = new URLSearchParams(window.location.search).get("next");
  return raw ? `/welcome?next=${encodeURIComponent(safeNext(raw))}` : "/welcome";
}

export function LoginForm({ initialMode = "signin" }: { initialMode?: "signin" | "signup" } = {}) {
  const router = useRouter();
  const { status } = useAuthSession();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [nextPath, setNextPath] = useState("/studio");
  useEffect(() => setNextPath(sameSiteNext()), []);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Don't mount the password form until we know the saved session is gone.
  // Otherwise a return visit refreshes the access token and the form (often
  // autofilled) asks for the password again a moment later.
  useEffect(() => {
    if (status === "authenticated") router.replace(welcomePath());
  }, [status, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthInput>({ resolver: zodResolver(authSchema) });

  async function onSubmit(values: AuthInput) {
    setErr("");
    setNotice("");
    if (mode === "signup" && !acceptedTerms) return setErr("Agree to the Terms, Privacy Policy, and Refund Policy to create an account.");
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword(values)
        : supabase.auth.signUp({
            ...values,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(welcomePath())}` },
          });
    const { data, error } = await fn;
    if (error) return setErr(error.message);
    if (mode === "signup" && !data.session) return setNotice("Check your email to confirm your account, then sign in.");
    // Role screen decides: first-timers pick Patient/Doctor, everyone else
    // is forwarded to ?next= or their role's home.
    router.push(welcomePath());
  }

  if (status !== "anonymous") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-mesh px-6 py-10">
        <OstrixLogo size="sm" withWordmark />
        <p role="status" className="text-sm text-text-secondary">Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-mesh px-6 py-10">
      <OstrixLogo size="sm" withWordmark />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-surface/90 p-8 shadow-lift backdrop-blur">
        <h2 className="font-display text-lg font-bold text-text-primary">
          {mode === "signin" ? `Sign in to ${BRAND.name}` : `Create your ${BRAND.name} account`}
        </h2>
        <p className="mb-5 mt-1 text-xs text-text-secondary">{BRAND.tagline}</p>

        {mode === "signup" && (
          <label className="mb-4 flex items-start gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
            <span>
              I agree to the <Link href="/terms" className="font-semibold text-accent">Terms</Link>,{" "}
              <Link href="/privacy" className="font-semibold text-accent">Privacy Policy</Link>, and{" "}
              <Link href="/refund" className="font-semibold text-accent">Refund Policy</Link>.
            </span>
          </label>
        )}

        {GOOGLE_LOGIN_ENABLED && (mode === "signin" || acceptedTerms) && (
          <>
            <GoogleButton next={nextPath} />
            <OrDivider />
          </>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <Input type="email" placeholder="Email" {...register("email")} />
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
          </div>
          <div>
            <Input type="password" placeholder="Password (min 6 characters)" {...register("password")} />
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
          </div>
          {mode === "signin" && (
            <div className="-mt-1 text-right">
              <a href="/forgot-password" className="text-xs font-medium text-accent">Forgot password?</a>
            </div>
          )}
          {err && <p className="text-xs text-red-400">{err}</p>}
          {notice && <p className="text-xs text-text-secondary">{notice}</p>}
          <Button type="submit" disabled={isSubmitting || (mode === "signup" && !acceptedTerms)} className="w-full justify-center">
            {isSubmitting ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="mt-4 text-xs text-text-secondary">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button className="font-semibold text-accent" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="font-semibold text-accent" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
      <p className="flex gap-4 text-xs text-text-muted">
        <Link href="/privacy" className="hover:text-accent">Privacy</Link>
        <Link href="/terms" className="hover:text-accent">Terms</Link>
        <Link href="/refund" className="hover:text-accent">Refunds</Link>
      </p>
    </div>
  );
}
