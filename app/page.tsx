import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, FileSignature, Lock, MapPin, MessageSquareText, Mic, PhoneCall,
  ShieldCheck, Sparkles, Stethoscope, UserRoundCheck, Video,
} from "lucide-react";

import { BRAND } from "@/lib/brand";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Button } from "@/components/ui/button";
import { HeaderActions, QuickActions } from "@/components/home/QuickActions";

const DESCRIPTION =
  "Ostrix offers online doctor consultations in Pakistan. Describe your symptoms, get matched to the right PMDC-verified specialist, consult by in-app video or audio, and receive a prescription your doctor has reviewed and digitally signed.";

export const metadata: Metadata = {
  title: `${BRAND.name} — Online doctor consultations in Pakistan`,
  description: DESCRIPTION,
  keywords: ["online doctor Pakistan", "telehealth", "PMDC verified doctor", "e-prescription", "video consultation"],
  openGraph: {
    title: `${BRAND.name} — See a PMDC-verified doctor from home`,
    description: DESCRIPTION,
    type: "website",
    siteName: BRAND.name,
    locale: "en_PK",
  },
  twitter: { card: "summary", title: `${BRAND.name} — Online doctor consultations in Pakistan`, description: DESCRIPTION },
};

const STEPS = [
  { icon: MessageSquareText, title: "Describe your symptoms", body: "Tell us what you're feeling in your own words — English or Roman Urdu. Emergency warning signs are flagged right away." },
  { icon: UserRoundCheck, title: "Get matched to a specialist", body: "AI suggests the right kind of specialist and shows you available PMDC-verified doctors. You choose and book." },
  { icon: Video, title: "Consult inside the app", body: "Talk to your doctor by in-app video or audio call — no extra apps — and send voice notes about your appointment." },
  { icon: FileSignature, title: "Signed prescription & pharmacy", body: "Your doctor reviews and digitally signs your prescription. Find nearby pharmacies with address and phone for home delivery." },
];

const FEATURES = [
  { icon: BadgeCheck, title: "PMDC-verified doctors", body: "Every doctor's PMDC registration is checked by our team before they can take consultations." },
  { icon: Lock, title: "Private, anonymized records", body: "Your health records are visible only to you and your doctor. Data shared for AI assistance is anonymized." },
  { icon: PhoneCall, title: "In-app video & audio calls", body: "Consult securely from your phone or laptop browser, plus voice notes when typing isn't easy." },
  { icon: ShieldCheck, title: "Verifiable prescriptions", body: "Each signed prescription has a code anyone — like a pharmacist — can check on our verify page." },
];

const FAQS = [
  { q: "Is the AI my doctor?", a: "No. AI helps organise your symptoms, suggest the right specialist and prepare a draft — but a licensed, PMDC-verified doctor reviews, edits and signs every prescription. No prescription is issued without your doctor's signature." },
  { q: "How do I pay?", a: "For now, payment is by bank transfer. After booking you'll see the account details; upload your transfer receipt and our team confirms it. Card payments are coming later." },
  { q: "What if it's an emergency?", a: "Ostrix is not for emergencies. If you have chest pain, difficulty breathing, severe bleeding, signs of stroke or any life-threatening symptoms, call 1122 or go to the nearest emergency department immediately." },
  { q: "Which devices work?", a: "Any modern browser on a phone, tablet or computer. For calls, allow microphone (and camera for video) access when asked." },
  { q: "How can a pharmacy check my prescription?", a: "Each signed prescription carries a verification code. The pharmacy can open the verify link to confirm it's genuine and unchanged." },
  { q: "I'm a doctor — can I join?", a: "Yes. Register with your PMDC number and credentials. Our team verifies your details before your profile goes live." },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h2 id={`${id}-title`} className="font-display mt-2 max-w-2xl text-3xl font-bold text-text-primary sm:text-4xl">{title}</h2>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-bg-surface focus:px-3 focus:py-2">Skip to content</a>

      <header className="sticky top-0 z-40 border-b border-border-subtle bg-bg-base/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label={`${BRAND.name} home`}><OstrixLogo size="sm" withWordmark /></Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-text-secondary md:flex">
            <a href="#how-it-works" className="hover:text-text-primary">How it works</a>
            <a href="#features" className="hover:text-text-primary">Why Ostrix</a>
            <a href="#for-doctors" className="hover:text-text-primary">For doctors</a>
            <a href="#faq" className="hover:text-text-primary">FAQ</a>
          </nav>
          <HeaderActions />
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-accent-glow blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div className="home-reveal">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface px-3 py-1 text-xs font-medium text-text-secondary">
                <BadgeCheck className="h-3.5 w-3.5 text-accent" aria-hidden /> PMDC-verified doctors · Pakistan
              </p>
              <h1 className="font-display mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                See a real doctor online, <span className="text-accent">from home.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-text-secondary">
                Describe your symptoms, get matched to the right specialist, consult by in-app video or audio, and receive a prescription your doctor has digitally signed.
              </p>
              <p lang="ur" dir="rtl" className="mt-2 text-base text-text-muted">{BRAND.urdu}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-glow">
                  <Link href="/triage">Check symptoms <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/studio">Book a doctor</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-text-muted">Emergency? Call <a href="tel:1122" className="font-semibold text-text-secondary underline">1122</a> — Ostrix is not for emergencies.</p>
              <QuickActions />
            </div>

            {/* Illustrative product card (no fake data) */}
            <div className="home-reveal home-delay-1 relative mx-auto w-full max-w-md" aria-hidden>
              <div className="rounded-2xl border border-border bg-bg-surface p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-2 text-sm font-medium"><Stethoscope className="h-4 w-4 text-accent" /> Symptom check</div>
                <div className="mt-4 rounded-lg bg-bg-elevated p-3 text-sm text-text-secondary">“Fever and sore throat for 3 days, painful swallowing.”</div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-border-subtle p-3 text-sm">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="text-text-secondary">Suggested: <span className="font-medium text-text-primary">General Physician</span>. A doctor will review your case.</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-text-secondary">
                  <div className="rounded-lg border border-border-subtle p-3"><Video className="mx-auto mb-1 h-4 w-4 text-accent" />Video</div>
                  <div className="rounded-lg border border-border-subtle p-3"><Mic className="mx-auto mb-1 h-4 w-4 text-accent" />Voice notes</div>
                  <div className="rounded-lg border border-border-subtle p-3"><FileSignature className="mx-auto mb-1 h-4 w-4 text-accent" />Signed Rx</div>
                </div>
              </div>
              <div className="home-float absolute -bottom-5 -left-3 flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2 text-xs shadow-lg sm:-left-8">
                <ShieldCheck className="h-4 w-4 text-green-600" /> Signed by your doctor
              </div>
            </div>
          </div>
        </section>

        <div className="border-y border-border-subtle bg-bg-surface">
          <Section id="how-it-works" eyebrow="How it works" title="From symptoms to a signed prescription in four steps">
            <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="home-card relative rounded-xl border border-border bg-bg-base p-5">
                  <span className="font-display absolute right-4 top-3 text-3xl font-bold text-border">{i + 1}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-glow"><Icon className="h-5 w-5 text-accent" aria-hidden /></span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-start gap-2 text-sm text-text-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> AI assists with organising information only. Diagnosis and prescriptions are always made by your doctor.
            </p>
          </Section>
        </div>

        <Section id="features" eyebrow="Why Ostrix" title="Care you can trust">
          <ul className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="home-card flex gap-4 rounded-xl border border-border bg-bg-surface p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-glow"><Icon className="h-5 w-5 text-accent" aria-hidden /></span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <section id="for-doctors" aria-labelledby="for-doctors-title" className="scroll-mt-20 px-5 pb-16 sm:pb-20">
          <div className="mx-auto grid max-w-6xl items-center gap-8 rounded-2xl border border-border bg-bg-elevated p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">For doctors</p>
              <h2 id="for-doctors-title" className="font-display mt-2 text-3xl font-bold sm:text-4xl">Consult patients online, on your schedule</h2>
              <ul className="mt-5 space-y-2 text-sm text-text-secondary">
                <li className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden /> Register with your PMDC number — verified by our team</li>
                <li className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden /> In-app calls with optional transcription and AI-drafted notes you edit</li>
                <li className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden /> Sign prescriptions digitally; patients and pharmacies can verify them</li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Button asChild size="lg"><Link href="/doctor/register">Register as a doctor <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></Link></Button>
              <Link href="/doctor/dashboard" className="text-sm text-text-secondary underline-offset-4 hover:underline">Already registered? Doctor dashboard</Link>
            </div>
          </div>
        </section>

        <div className="border-t border-border-subtle bg-bg-surface">
          <Section id="faq" eyebrow="FAQ" title="Questions, answered">
            <div className="grid gap-3 lg:grid-cols-2">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group rounded-xl border border-border bg-bg-base p-5 open:border-accent/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                    {q}
                    <span aria-hidden className="text-xl leading-none text-text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{a}</p>
                </details>
              ))}
            </div>
          </Section>
        </div>

        <section className="px-5 py-16 text-center">
          <h2 className="font-display text-3xl font-bold">Not feeling well?</h2>
          <p className="mx-auto mt-3 max-w-md text-text-secondary">Start with a quick symptom check — it takes a couple of minutes.</p>
          <Button asChild size="lg" className="mt-6 shadow-glow"><Link href="/triage">Check symptoms <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden /></Link></Button>
        </section>
      </main>

      <footer className="border-t border-border-subtle bg-bg-surface px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <OstrixLogo size="sm" withWordmark />
            <p className="mt-2 max-w-xs text-xs text-text-muted">Online doctor consultations in Pakistan. Not for emergencies — call 1122.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-text-secondary sm:grid-cols-3 sm:gap-x-10">
            <Link href="/triage" className="hover:text-text-primary">Check symptoms</Link>
            <Link href="/studio" className="hover:text-text-primary">Book a doctor</Link>
            <Link href="/my-care" className="hover:text-text-primary">My care</Link>
            <Link href="/login" className="hover:text-text-primary">Sign in</Link>
            <Link href="/doctor/register" className="hover:text-text-primary">For doctors</Link>
            <a href="#faq" className="hover:text-text-primary">FAQ</a>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-xs text-text-muted">© {new Date().getFullYear()} {BRAND.name}</p>
      </footer>
    </div>
  );
}
