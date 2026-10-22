"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { safeNext } from "@/lib/authRedirect";
import { OstrixLogo } from "@/components/brand/OstrixLogo";

/**
 * OAuth / email-link landing page. Handles both PKCE (?code=) and implicit
 * (#access_token) responses, then forwards to ?next=. No profile row is needed
 * here: like email signup, a new auth user starts as a patient, and doctors
 * opt in via /doctor/register.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [err, setErr] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = safeNext(params.get("next"));
    const oauthErr = params.get("error_description") || hash.get("error_description");
    if (oauthErr) return setErr(oauthErr);

    (async () => {
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return setErr(error.message);
      }
      // Implicit flow: supabase-js picks the hash up on init; give it a moment.
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const isRecovery = hash.get("type") === "recovery" || params.get("type") === "recovery";
          return router.replace(isRecovery ? "/reset-password" : next);
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      setErr("We couldn't complete sign-in. The link may have expired.");
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg-base px-6">
      <OstrixLogo size="sm" withWordmark />
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-surface p-7 text-center">
        {err ? (
          <>
            <p className="text-sm text-red-400">{err}</p>
            <a href="/login" className="mt-4 inline-block text-xs font-semibold text-accent">Back to sign in</a>
          </>
        ) : (
          <p className="text-sm text-text-secondary">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
