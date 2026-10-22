import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Globe, Siren } from "lucide-react";

import { BRAND } from "@/lib/brand";
import { LICENSING_NOTE } from "@/lib/company";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Button } from "@/components/ui/button";
import { CompanyInfo } from "@/components/home/CompanyInfo";

export const metadata: Metadata = {
  title: `About ${BRAND.name}`,
  description: `${BRAND.name} offers online doctor consultations anywhere in the world with PMDC-registered doctors licensed in Pakistan.`,
};

export default function AboutPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label={`${BRAND.name} home`}><OstrixLogo size="sm" withWordmark /></Link>
        <Link href="/" className="flex items-center gap-1 text-sm text-text-secondary hover:text-accent"><ArrowLeft className="h-4 w-4" aria-hidden /> Home</Link>
      </div>
      <header>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">About {BRAND.name}</h1>
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">
          {BRAND.name} lets you consult a real doctor online, wherever you are. Describe your symptoms, get matched to the right specialist, talk to your doctor by in-app video or audio, and receive a prescription your doctor has reviewed and digitally signed.
        </p>
      </header>
      <section className="grid gap-4">
        <div className="flex gap-4 rounded-2xl border border-border bg-bg-surface p-5 shadow-card">
          <BadgeCheck className="h-6 w-6 shrink-0 text-accent" aria-hidden />
          <div><h2 className="font-semibold">Our doctors</h2><p className="mt-1 text-sm text-text-secondary">{LICENSING_NOTE}</p></div>
        </div>
        <div className="flex gap-4 rounded-2xl border border-border bg-bg-surface p-5 shadow-card">
          <Globe className="h-6 w-6 shrink-0 text-accent" aria-hidden />
          <div><h2 className="font-semibold">How AI is used</h2><p className="mt-1 text-sm text-text-secondary">AI helps organise your symptoms and prepare drafts. Your doctor makes every medical decision and signs every prescription.</p></div>
        </div>
        <div className="flex gap-4 rounded-2xl border border-border bg-warm-soft p-5">
          <Siren className="h-6 w-6 shrink-0 text-warm-strong" aria-hidden />
          <div><h2 className="font-semibold">Not for emergencies</h2><p className="mt-1 text-sm text-text-secondary">In an emergency, call your local emergency number (1122 in Pakistan) or go to the nearest emergency department.</p></div>
        </div>
      </section>
      <CompanyInfo className="rounded-2xl border border-border bg-bg-surface p-5 text-sm" />
      <div><Button asChild size="lg"><Link href="/triage">Check symptoms</Link></Button></div>
    </div>
  );
}
