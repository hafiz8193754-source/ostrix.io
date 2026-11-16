"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MessageSquare, Stethoscope, LogIn } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/useAuthSession";

// Header actions: signed-out visitors see "Sign in"; signed-in users get
// their quick actions (consult, my care, doctor dashboard for doctors).
export function HeaderActions() {
  const { status } = useAuthSession();
  if (status === "loading") {
    return <div className="h-8 w-24" aria-hidden />;
  }
  if (status === "authenticated") {
    return (
      <Button asChild size="sm">
        <Link href="/my-care">My care</Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <Link href="/login">
          <LogIn className="mr-1.5 h-4 w-4" aria-hidden /> Sign in
        </Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/signup">Sign up</Link>
      </Button>
    </div>
  );
}

export function QuickActions() {
  const { status, session } = useAuthSession();
  const [doctor, setDoctor] = useState(false);
  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    let alive = true;
    supabase
      .from("doctors")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setDoctor(!!data);
      });
    return () => {
      alive = false;
    };
  }, [status, session]);
  if (status !== "authenticated") return null;
  const items = [
    { href: "/triage", label: "Check symptoms", icon: Stethoscope },
    { href: "/studio", label: "Talk to a doctor", icon: MessageSquare },
    { href: "/my-care", label: "My appointments & prescriptions", icon: CalendarDays },
    ...(doctor ? [{ href: "/doctor/dashboard", label: "Doctor dashboard", icon: Stethoscope }] : []),
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
