import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Check, FileSignature, Lock, MapPin, MessageSquareText, Mic, PhoneCall,
  ShieldCheck, Siren, Sparkles, Stethoscope, UserRoundCheck, Video,
} from "lucide-react";

import { BRAND } from "@/lib/brand";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Button } from "@/components/ui/button";
import { LICENSING_NOTE } from "@/lib/company";
import { CompanyInfo } from "@/components/home/CompanyInfo";
import { HeaderActions, QuickActions } from "@/components/home/QuickActions";

const DESCRIPTION =
  "Ostrix offers online doctor consultations, anywhere in the world. Describe your symptoms, get matched to the right PMDC-registered specialist, consult by in-app video or audio, and receive a prescription your doctor has reviewed and digitally signed.";

export const metadata: Metadata = {
  title: `${BRAND.name} — Online doctor consultations, anywhere in the world`,
  description: DESCRIPTION,
  keywords: ["online doctor", "online doctor consultation", "telehealth", "online doctor Pakistan", "PMDC verified doctor", "e-prescription", "video consultation"],
  openGraph: {
    title: `${BRAND.name} — See a PMDC-verified doctor from home`,
    description: DESCRIPTION,
    type: "website",
    siteName: BRAND.name,
    locale: "en_US",
  },
  twitter: { card: "summary", title: `${BRAND.name} — Online doctor consultations, anywhere in the world`, description: DESCRIPTION },
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
  { q: "What if it's an emergency?", a: "Ostrix is not for emergencies. If you have chest pain, difficulty breathing, severe bleeding, signs of stroke or any life-threatening symptoms, call your local emergency number (1122 in Pakistan) or go to the nearest emergency department immediately." },
  { q: "Where are the doctors licensed? Can I use Ostrix outside Pakistan?", a: LICENSING_NOTE + " You can consult from anywhere with an internet connection." },
  { q: "Which devices work?", a: "Any modern browser on a phone, tablet or computer. For calls, allow microphone (and camera for video) access when asked." },
  { q: "How can a pharmacy check my prescription?", a: "Each signed prescription carries a verification code. The pharmacy can open the verify link to confirm it's genuine and unchanged." },
  { q: "I'm a doctor — can I join?", a: "Yes. Register with your PMDC number and credentials. Our team verifies your details before your profile goes live." },
];


function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
      <span aria-hidden className="h-px w-6 bg-accent" /> {children}
    </p>
  );
}

function HeroMock() {
  return (
    <div aria-hidden className="relative mx-auto h-[440px] w-full max-w-[460px] sm:h-[480px]">
      {/* Symptom card */}
      <div className="home-reveal home-delay-1 absolute left-0 top-0 w-[78%] rounded-2xl border border-border bg-bg-surface p-4 shadow-lift">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft"><Stethoscope className="h-3.5 w-3.5 text-accent" /></span>
          Symptom check
        </div>
        <p className="mt-3 rounded-xl bg-bg-elevated px-3 py-2.5 text-sm text-text-primary">“Bukhar aur gale mein dard, 3 din se.”</p>
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-text-primary">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" /> Suggested specialist: <b className="font-semibold">General Physician</b>
        </div>
      </div>

      {/* Call card */}
      <div className="home-reveal home-delay-2 absolute right-0 top-[34%] w-[66%] overflow-hidden rounded-2xl border border-border bg-[#0B2A27] shadow-lift">
        <div className="relative h-32 bg-[radial-gradient(circle_at_30%_40%,#14b8a6_0%,transparent_55%),radial-gradient(circle_at_80%_70%,#f59e0b55_0%,transparent_50%)]">
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-red-400" /> In-app video visit
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/10"><Video className="h-6 w-6 text-white" /></span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 bg-[#0B2A27] p-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><Mic className="h-3.5 w-3.5 text-white" /></span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"><Video className="h-3.5 w-3.5 text-white" /></span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500"><PhoneCall className="h-3.5 w-3.5 rotate-[135deg] text-white" /></span>
        </div>
      </div>

      {/* Prescription card */}
      <div className="home-reveal home-delay-3 absolute bottom-0 left-[6%] w-[72%] rounded-2xl border border-border bg-bg-surface p-4 shadow-lift">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary"><FileSignature className="h-4 w-4 text-accent" /> Prescription</span>
          <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent"><BadgeCheck className="h-3 w-3" /> Signed</span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-2 w-4/5 rounded-full bg-bg-overlay" />
          <div className="h-2 w-3/5 rounded-full bg-bg-overlay" />
          <div className="h-2 w-2/3 rounded-full bg-bg-overlay" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[10px] text-text-muted">
          <span className="font-mono">Verify code</span>
          <span className="flex items-center gap-1 text-warm-strong"><MapPin className="h-3 w-3" /> Nearby pharmacies</span>
        </div>
      </div>
      <div className="home-float absolute -right-2 top-2 hidden rounded-full border border-border bg-bg-surface px-3 py-1.5 text-[11px] font-medium shadow-card sm:flex sm:items-center sm:gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Reviewed by your doctor
      </div>
    </div>
  );
}

export default function Landing() {
  const [f0, f1, f2, f3] = FEATURES;
  return (
    <div className="min-h-screen text-text-primary">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-bg-surface focus:px-3 focus:py-2">Skip to content</a>

      <header className="sticky top-0 z-40 border-b border-border-subtle/70 bg-bg-base/75 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label={`${BRAND.name} home`}><OstrixLogo size="sm" withWordmark /></Link>
          <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium text-text-secondary md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-accent">How it works</a>
            <a href="#features" className="transition-colors hover:text-accent">Why Ostrix</a>
            <a href="#for-doctors" className="transition-colors hover:text-accent">For doctors</a>
            <a href="#faq" className="transition-colors hover:text-accent">FAQ</a>
          </nav>
          <HeaderActions />
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-mesh px-5 pb-20 pt-12 sm:pb-28 sm:pt-20">
          <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
            <div className="home-reveal">
              <p className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-bg-surface/80 px-3 py-1.5 text-xs font-semibold text-accent shadow-card backdrop-blur">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> PMDC-registered doctors · Online, worldwide
              </p>
              <h1 className="font-display mt-6 text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl xl:text-[4.25rem]">
                A real doctor,<br /><span className="text-gradient whitespace-nowrap">right from home.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-secondary">
                Describe your symptoms, get matched to the right specialist, consult by in-app video or audio, and receive a prescription your doctor has digitally signed.
              </p>
              <p lang="ur" dir="rtl" className="mt-2 max-w-xl text-base text-text-muted">{BRAND.urdu}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/triage">Check symptoms <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/studio">Book a doctor</Link>
                </Button>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-secondary">
                <li className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" aria-hidden /> Doctor signs every prescription</li>
                <li className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" aria-hidden /> English, اردو, Roman Urdu</li>
              </ul>
              <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-warm-soft px-3 py-2 text-xs text-text-secondary">
                <Siren className="h-3.5 w-3.5 text-warm-strong" aria-hidden /> Emergency? Call your local emergency number (<a href="tel:1122" className="font-semibold text-warm-strong underline">1122</a> in Pakistan). Ostrix is not for emergencies.
              </p>
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-text-muted">{LICENSING_NOTE}</p>
              <QuickActions />
            </div>
            <HeroMock />
          </div>
        </section>

        {/* How it works — timeline */}
        <section id="how-it-works" aria-labelledby="hiw-title" className="scroll-mt-20 border-y border-border-subtle bg-bg-surface px-5 py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>How it works</Eyebrow>
              <h2 id="hiw-title" className="font-display mt-3 text-3xl font-bold sm:text-5xl">From symptoms to a signed prescription</h2>
              <p className="mt-4 max-w-md text-text-secondary">Four simple steps. AI helps organise things; your doctor makes every medical decision.</p>
              <Button asChild className="mt-7"><Link href="/triage">Start now <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
            </div>
            <ol className="relative space-y-5 before:absolute before:bottom-8 before:left-[23px] before:top-8 before:w-px before:bg-gradient-to-b before:from-accent before:via-accent/40 before:to-warm sm:space-y-6">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="home-card relative flex gap-5 rounded-2xl border border-border bg-bg-base p-5 sm:p-6">
                  <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-card">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-accent">Step {i + 1}</p>
                    <h3 className="font-display mt-0.5 text-lg font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features — bento */}
        <section id="features" aria-labelledby="features-title" className="scroll-mt-20 px-5 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <Eyebrow>Why Ostrix</Eyebrow>
              <h2 id="features-title" className="font-display mt-3 text-3xl font-bold sm:text-5xl">Care you can actually trust</h2>
            </div>
            <ul className="mt-12 grid gap-5 md:grid-cols-3 md:grid-rows-2">
              <li className="home-card relative overflow-hidden rounded-3xl bg-accent p-7 text-accent-fg shadow-lift md:col-span-2 md:row-span-1">
                <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
                <f0.icon className="h-8 w-8" aria-hidden />
                <h3 className="font-display mt-6 text-2xl font-bold">{f0.title}</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed opacity-90">{f0.body}</p>
              </li>
              <li className="home-card rounded-3xl border border-border bg-bg-surface p-7 shadow-card md:row-span-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warm-soft"><f1.icon className="h-6 w-6 text-warm-strong" aria-hidden /></span>
                <h3 className="font-display mt-6 text-xl font-bold">{f1.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{f1.body}</p>
                <div aria-hidden className="mt-8 space-y-2 rounded-2xl bg-bg-elevated p-4">
                  {["Name", "Phone", "CNIC"].map((k) => (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">{k}</span>
                      <span className="rounded bg-bg-overlay px-2 py-0.5 font-mono text-text-secondary">••••••</span>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-text-muted">Personal details are removed before AI assistance.</p>
                </div>
              </li>
              {[f2, f3].map((f) => (
                <li key={f.title} className="home-card rounded-3xl border border-border bg-bg-surface p-7 shadow-card">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft"><f.icon className="h-6 w-6 text-accent" aria-hidden /></span>
                  <h3 className="font-display mt-6 text-xl font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* For doctors */}
        <section id="for-doctors" aria-labelledby="for-doctors-title" className="scroll-mt-20 px-5 pb-20 sm:pb-28">
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-3xl bg-[#0B2A27] p-8 text-white shadow-lift sm:p-14 lg:grid-cols-[1.3fr_1fr]">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(20,184,166,0.35),transparent_60%),radial-gradient(40%_60%_at_0%_100%,rgba(245,158,11,0.18),transparent_60%)]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">For doctors</p>
              <h2 id="for-doctors-title" className="font-display mt-3 text-3xl font-bold sm:text-5xl">Consult patients online, on your schedule</h2>
              <ul className="mt-6 space-y-3 text-[15px] text-white/80">
                {["Register with your PMDC number, verified by our team", "In-app calls with optional transcription and AI-drafted notes you edit", "Sign prescriptions digitally; patients and pharmacies can verify them"].map((t) => (
                  <li key={t} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" aria-hidden /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="relative flex flex-col gap-4 lg:items-end">
              <Link href="/doctor/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-[#0B2A27] shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B2A27]">
                Register as a doctor <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/doctor/dashboard" className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">Already registered? Doctor dashboard</Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-border-subtle bg-bg-surface px-5 py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Eyebrow>FAQ</Eyebrow>
              <h2 id="faq-title" className="font-display mt-3 text-3xl font-bold sm:text-5xl">Questions, answered</h2>
              <p className="mt-4 text-text-secondary">Still unsure? Start with a free symptom check, with no commitment.</p>
            </div>
            <div className="space-y-3">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group rounded-2xl border border-border bg-bg-base p-5 transition-colors open:border-accent/40 open:bg-accent-soft/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
                    {q}
                    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-surface text-lg leading-none text-accent shadow-card transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="px-5 py-20">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-accent via-[#0E8A7F] to-[#0B5E57] px-6 py-14 text-center text-white shadow-lift sm:py-20">
            <div aria-hidden className="bg-grid absolute inset-0 opacity-20" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold sm:text-5xl">Not feeling well?</h2>
              <p className="mx-auto mt-4 max-w-md text-white/85">Start with a quick symptom check. It takes a couple of minutes.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/triage" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-[#0B5E57] shadow-card transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-accent">
                  Check symptoms <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/studio" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 px-7 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  Book a doctor
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle bg-bg-surface px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <OstrixLogo size="sm" withWordmark />
            <p className="mt-3 max-w-xs text-sm text-text-muted">Online doctor consultations, anywhere in the world. Not for emergencies: call your local emergency number (1122 in Pakistan).</p>
            <p className="mt-2 max-w-xs text-xs text-text-muted">Doctors are PMDC-registered and licensed in Pakistan.</p>
            <CompanyInfo className="mt-4 max-w-xs" />
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-sm text-text-secondary sm:grid-cols-3">
            <Link href="/triage" className="hover:text-accent">Check symptoms</Link>
            <Link href="/studio" className="hover:text-accent">Book a doctor</Link>
            <Link href="/my-care" className="hover:text-accent">My care</Link>
            <Link href="/login" className="hover:text-accent">Sign in</Link>
            <Link href="/doctor/register" className="hover:text-accent">For doctors</Link>
            <Link href="/about" className="hover:text-accent">About Ostrix</Link>
            <a href="#faq" className="hover:text-accent">FAQ</a>
          </nav>
        </div>
        <p className="mx-auto mt-10 max-w-6xl border-t border-border-subtle pt-6 text-xs text-text-muted">© {new Date().getFullYear()} {BRAND.name}</p>
      </footer>
    </div>
  );
}
