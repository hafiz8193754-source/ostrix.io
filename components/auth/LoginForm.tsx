"use client";

import { useEffect, useState } from "react";
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

// Google sign-in is off until the Google provider is configured in Supabase.
// Flip to true (or set NEXT_PUBLIC_GOOGLE_LOGIN=1) to show the button again.
const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

function sameSiteNext(): string {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}

export function LoginForm({ initialMode = "signin" }: { initialMode?: "signin" | "signup" } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [nextPath, setNextPath] = useState("/studio");
  useEffect(() => setNextPath(sameSiteNext()), []);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthInput>({ resolver: zodResolver(authSchema) });

  async function onSubmit(values: AuthInput) {
    setErr("");
    setNotice("");
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword(values)
        : supabase.auth.signUp(values);
    const { data, error } = await fn;
    if (error) return setErr(error.message);
    if (mode === "signup" && !data.session) return setNotice("Check your email to confirm your account, then sign in.");
    router.push(sameSiteNext());
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg-base px-6">
      <OstrixLogo size="sm" withWordmark />
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-surface p-7">
        <h2 className="font-display text-lg font-bold text-text-primary">
          {mode === "signin" ? `Sign in to ${BRAND.name}` : `Create your ${BRAND.name} account`}
        </h2>
        <p className="mb-5 mt-1 text-xs text-text-secondary">{BRAND.tagline}</p>

        {GOOGLE_LOGIN_ENABLED && (
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
          <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
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
    </div>
  );
}
