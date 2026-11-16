"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import { LOADING_AUTH, loginPathFor, reduceAuth, shouldRedirectToLogin, type AuthStatus } from "@/lib/authGate";
import { supabase } from "@/lib/supabaseClient";

export function useAuthSession(): { status: AuthStatus; session: Session | null } {
  const [state, setState] = useState(LOADING_AUTH);

  useEffect(() => {
    let alive = true;
    function apply(session: Session | null, from: "storage" | "listener") {
      if (!alive) return;
      setState((current) => reduceAuth(current, { session, from }));
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session, "storage"));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "PASSWORD_RECOVERY"
      ) {
        apply(session, "listener");
      }
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { status: state.status, session: state.session as Session | null };
}

/** Wait until the stored session is restored. Redirect only after that, and remember where the user was. */
export function useRequireSession(): { status: AuthStatus; session: Session | null } {
  const auth = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldRedirectToLogin(auth.status)) return;
    router.replace(loginPathFor(pathname, window.location.search || ""));
  }, [auth.status, pathname, router]);

  return auth;
}
