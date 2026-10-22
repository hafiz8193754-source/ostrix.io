"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MessageSquare, Stethoscope, LogIn } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

// Header actions: signed-out visitors see "Sign in"; signed-in users get
// their quick actions (consult, my care, doctor dashboard for doctors).
export function HeaderActions() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (signedIn) {
    return (
      <Button asChild size="sm">
        <Link href="/my-care">My care</Link>
      </Button>
    );
  }
  return (
    <Button asChild size="sm" variant="outline">
      <Link href="/login">
        <LogIn className="mr-1.5 h-4 w-4" aria-hidden /> Sign in
      </Link>
    </Button>
  );
}

export function QuickActions() {
  const [state, setState] = useState<{ signedIn: boolean; doctor: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (!s) return alive && setState({ signedIn: false, doctor: false });
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", s.user.id).maybeSingle();
      if (alive) setState({ signedIn: true, doctor: !!doc });
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!state?.signedIn) return null;
  const items = [
    { href: "/triage", label: "Check symptoms", icon: Stethoscope },
    { href: "/studio", label: "Talk to a doctor", icon: MessageSquare },
    { href: "/my-care", label: "My appointments & prescriptions", icon: CalendarDays },
    ...(state.doctor ? [{ href: "/doctor/dashboard", label: "Doctor dashboard", icon: Stethoscope }] : []),
  ];
  return (
    <nav aria-label="Your quick actions" className="mt-8 animate-fade-up rounded-lg border border-border bg-bg-surface p-4 text-left">
      <p className="mb-3 text-sm font-medium text-text-secondary">Welcome back — pick up where you left off</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2.5 text-sm text-text-primary transition hover:border-accent hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon className="h-4 w-4 text-accent" aria-hidden /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
