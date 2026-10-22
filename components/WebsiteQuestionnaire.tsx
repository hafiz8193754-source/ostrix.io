"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Utensils,
  Camera,
  Stethoscope,
  Home,
  ShoppingCart,
  Briefcase,
  GraduationCap,
  Wrench,
  Sparkles,
  Paperclip,
  X,
  Pencil,
  Rocket,
  type LucideIcon,
} from "lucide-react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { readPhoto } from "@/lib/image";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

const CATEGORIES: Category[] = [
  { id: "restaurant", label: "Restaurant & Cafe", subtitle: "Restaurants, cafes, bakeries, catering", icon: Utensils },
  { id: "portfolio", label: "Portfolio & Creative", subtitle: "Photographers, designers, artists", icon: Camera },
  { id: "clinic", label: "Doctor & Clinic", subtitle: "Clinics, dentists, healthcare", icon: Stethoscope },
  { id: "realestate", label: "Real Estate", subtitle: "Agents, builders, property listings", icon: Home },
  { id: "ecommerce", label: "E-Commerce & Shop", subtitle: "Online stores, boutiques, retail", icon: ShoppingCart },
  { id: "consultancy", label: "Consultancy & Agency", subtitle: "Consulting, marketing, agencies", icon: Briefcase },
  { id: "school", label: "School & Academy", subtitle: "Schools, tutors, academies", icon: GraduationCap },
  { id: "service", label: "Service Business", subtitle: "Repair, salons, home services", icon: Wrench },
  { id: "other", label: "Other / Custom", subtitle: "Something else entirely", icon: Sparkles },
];

const FEATURES = [
  "Online Menu",
  "Booking/Reservation",
  "Contact Form",
  "Photo Gallery",
  "Price List",
  "WhatsApp Button",
  "Testimonials",
  "Team/Staff Page",
  "Blog Section",
  "Social Media Links",
  "Google Maps",
  "FAQ Section",
];

type Style = "dark" | "light" | "auto";

interface Answers {
  category: Category | null;
  businessName: string;
  location: string;
  services: string;
  phone: string;
  email: string;
  whatsapp: string;
  whatsappSame: boolean;
  features: string[];
  style: Style | null;
  styleNote: string;
  screenshot: { data: string; type: string; preview: string } | null;
}

const INITIAL_ANSWERS: Answers = {
  category: null,
  businessName: "",
  location: "",
  services: "",
  phone: "",
  email: "",
  whatsapp: "",
  whatsappSame: true,
  features: [],
  style: null,
  styleNote: "",
  screenshot: null,
};

interface WebsiteQuestionnaireProps {
  onComplete: (brief: string, screenshot?: { data: string; type: string }) => void;
  onSkip: () => void;
}

function buildBrief(a: Answers): string {
  const categoryLabel = a.category?.label || "business";
  let brief = `Create a ${categoryLabel} website for "${a.businessName}" located in ${a.location}.`;
  brief += ` Main services/products: ${a.services}.`;
  brief += ` Contact: phone ${a.phone}, email ${a.email}.`;
  const wa = a.whatsappSame ? a.phone : a.whatsapp;
  if (wa) brief += ` WhatsApp: ${wa}.`;
  if (a.features.length) brief += ` Must include: ${a.features.join(", ")}.`;
  if (a.style && a.style !== "auto") brief += ` Design preference: ${a.style === "dark" ? "dark and modern" : "light and clean"}.`;
  if (a.styleNote.trim()) brief += ` Additional style notes: ${a.styleNote.trim()}.`;
  return brief;
}

function OstrixBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 self-start">
      <div className="mt-1 shrink-0">
        <OstrixLogo size="xs" />
      </div>
      <div className="max-w-[720px] rounded-[18px] rounded-bl-sm border border-border bg-bg-surface px-5 py-3.5 text-[15px] leading-[1.65] text-text-primary">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="self-end rounded-[18px] rounded-br-sm bg-bg-elevated px-5 py-3.5 text-[15px] leading-[1.65] text-text-primary">
      {children}
    </div>
  );
}

function StepShell({ children, stepKey }: { children: React.ReactNode; stepKey: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);
  return (
    <motion.div
      key={stepKey}
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3"
    >
      {children}
    </motion.div>
  );
}

export function WebsiteQuestionnaire({ onComplete, onSkip }: WebsiteQuestionnaireProps) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nameDraft, setNameDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [servicesDraft, setServicesDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [whatsappDraft, setWhatsappDraft] = useState("");
  const [whatsappSameDraft, setWhatsappSameDraft] = useState(true);
  const [featuresDraft, setFeaturesDraft] = useState<string[]>([]);
  const [styleNoteDraft, setStyleNoteDraft] = useState("");

  function goTo(next: number) {
    setStep(next);
  }

  function selectCategory(cat: Category) {
    setAnswers((a) => ({ ...a, category: cat }));
    goTo(2);
  }

  function submitName() {
    if (!nameDraft.trim()) return;
    setAnswers((a) => ({ ...a, businessName: nameDraft.trim() }));
    goTo(3);
  }

  function submitLocation() {
    if (!locationDraft.trim()) return;
    setAnswers((a) => ({ ...a, location: locationDraft.trim() }));
    goTo(4);
  }

  function submitServices() {
    if (!servicesDraft.trim()) return;
    setAnswers((a) => ({ ...a, services: servicesDraft.trim() }));
    goTo(5);
  }

  function submitContact() {
    if (!phoneDraft.trim() || !emailDraft.trim()) return;
    setAnswers((a) => ({
      ...a,
      phone: phoneDraft.trim(),
      email: emailDraft.trim(),
      whatsapp: whatsappDraft.trim(),
      whatsappSame: whatsappSameDraft,
    }));
    goTo(6);
  }

  function submitFeatures() {
    setAnswers((a) => ({ ...a, features: featuresDraft }));
    goTo(7);
  }

  function selectStyle(style: Style) {
    setAnswers((a) => ({ ...a, style, styleNote: styleNoteDraft.trim() }));
    goTo(8);
  }

  function submitStyleNote() {
    if (!styleNoteDraft.trim()) return;
    setAnswers((a) => ({ ...a, style: a.style || "auto", styleNote: styleNoteDraft.trim() }));
    goTo(8);
  }

  async function handleScreenshot(file: File) {
    try {
      const resized = await readPhoto(file, 1200);
      setAnswers((a) => ({ ...a, screenshot: resized }));
    } catch {
      // optional — ignore a failed resize
    }
  }

  function generate() {
    if (submitting) return;
    setSubmitting(true);
    const brief = buildBrief(answers);
    onComplete(brief, answers.screenshot ? { data: answers.screenshot.data, type: answers.screenshot.type } : undefined);
  }

  function editAgain() {
    setNameDraft(answers.businessName);
    setLocationDraft(answers.location);
    setServicesDraft(answers.services);
    setPhoneDraft(answers.phone);
    setEmailDraft(answers.email);
    setWhatsappDraft(answers.whatsapp);
    setWhatsappSameDraft(answers.whatsappSame);
    setFeaturesDraft(answers.features);
    setStyleNoteDraft(answers.styleNote);
    goTo(1);
  }

  const whatsappValue = answers.whatsappSame ? answers.phone : answers.whatsapp;

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Step 1 recap / live */}
      {step === 1 ? (
        <StepShell stepKey={1}>
          <OstrixBubble>What type of website do you need? Pick a category for the best results:</OstrixBubble>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => selectCategory(cat)}
                className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-3.5 text-left transition-colors hover:border-accent hover:bg-accent-glow"
              >
                <cat.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <span>
                  <span className="block text-sm font-medium text-text-primary">{cat.label}</span>
                  <span className="block text-xs text-text-muted">{cat.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
          <button onClick={onSkip} className="self-start text-xs font-medium text-text-secondary hover:text-accent">
            Or just describe what you need →
          </button>
        </StepShell>
      ) : (
        answers.category && <UserBubble>{answers.category.label}</UserBubble>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <StepShell stepKey={2}>
          <OstrixBubble>What is the name of your business?</OstrixBubble>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitName()}
              placeholder="e.g. Saffron Kitchen"
              className="h-11 flex-1 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent"
            />
            <button
              onClick={submitName}
              disabled={!nameDraft.trim()}
              className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        </StepShell>
      )}
      {step > 2 && answers.businessName && <UserBubble>{answers.businessName}</UserBubble>}

      {/* Step 3 */}
      {step === 3 && (
        <StepShell stepKey={3}>
          <OstrixBubble>Where is your business located? (City and area)</OstrixBubble>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={locationDraft}
              onChange={(e) => setLocationDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitLocation()}
              placeholder="e.g. Gulberg III, Lahore"
              className="h-11 flex-1 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent"
            />
            <button
              onClick={submitLocation}
              disabled={!locationDraft.trim()}
              className="h-11 shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        </StepShell>
      )}
      {step > 3 && answers.location && <UserBubble>{answers.location}</UserBubble>}

      {/* Step 4 */}
      {step === 4 && (
        <StepShell stepKey={4}>
          <OstrixBubble>What are your main services or products? (List 3-5)</OstrixBubble>
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              value={servicesDraft}
              onChange={(e) => setServicesDraft(e.target.value)}
              placeholder="e.g. Chicken Karahi, BBQ Platters, Biryani, Naan, Desserts"
              rows={2}
              className="resize-none rounded-xl border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent"
            />
            <button
              onClick={submitServices}
              disabled={!servicesDraft.trim()}
              className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </StepShell>
      )}
      {step > 4 && answers.services && <UserBubble>{answers.services}</UserBubble>}

      {/* Step 5 */}
      {step === 5 && (
        <StepShell stepKey={5}>
          <OstrixBubble>What contact details should the website show?</OstrixBubble>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              placeholder="Phone — e.g. +92 300 1234567"
              className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent"
            />
            <input
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="Email — e.g. info@yourbusiness.com"
              className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent"
            />
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={whatsappSameDraft}
                onChange={(e) => setWhatsappSameDraft(e.target.checked)}
                className="h-3.5 w-3.5 accent-accent"
              />
              WhatsApp same as phone number
            </label>
            {!whatsappSameDraft && (
              <input
                value={whatsappDraft}
                onChange={(e) => setWhatsappDraft(e.target.value)}
                placeholder="WhatsApp number"
                className="h-11 rounded-xl border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent"
              />
            )}
            <button
              onClick={submitContact}
              disabled={!phoneDraft.trim() || !emailDraft.trim()}
              className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </StepShell>
      )}
      {step > 5 && answers.phone && (
        <UserBubble>
          {answers.phone} · {answers.email}
          {whatsappValue ? ` · WhatsApp: ${answers.whatsappSame ? "same as phone" : whatsappValue}` : ""}
        </UserBubble>
      )}

      {/* Step 6 */}
      {step === 6 && (
        <StepShell stepKey={6}>
          <OstrixBubble>Any special features you need? (Select all that apply)</OstrixBubble>
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((f) => {
              const active = featuresDraft.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => setFeaturesDraft((fs) => (active ? fs.filter((x) => x !== f) : [...fs, f]))}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    active ? "border-accent bg-accent-glow text-accent" : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <button onClick={submitFeatures} className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black">
            Continue
          </button>
        </StepShell>
      )}
      {step > 6 && (
        <UserBubble>{answers.features.length ? answers.features.join(", ") : "No special features — keep it simple"}</UserBubble>
      )}

      {/* Step 7 */}
      {step === 7 && (
        <StepShell stepKey={7}>
          <OstrixBubble>Any color or style preference?</OstrixBubble>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => selectStyle("dark")} className="rounded-full border border-border bg-bg-elevated px-4 py-2 text-sm text-text-secondary hover:border-accent hover:text-text-primary">
              Dark & Modern
            </button>
            <button onClick={() => selectStyle("light")} className="rounded-full border border-border bg-bg-elevated px-4 py-2 text-sm text-text-secondary hover:border-accent hover:text-text-primary">
              Light & Clean
            </button>
            <button onClick={() => selectStyle("auto")} className="rounded-full border border-border bg-bg-elevated px-4 py-2 text-sm text-text-secondary hover:border-accent hover:text-text-primary">
              Let Ostrix decide
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={styleNoteDraft}
              onChange={(e) => setStyleNoteDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitStyleNote()}
              placeholder="Or describe your preference: e.g. 'blue and white, minimal'"
              className="h-10 flex-1 rounded-xl border border-border bg-bg-elevated px-3.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus-visible:border-accent"
            />
            <button
              onClick={submitStyleNote}
              disabled={!styleNoteDraft.trim()}
              className="h-10 shrink-0 rounded-xl border border-border px-3 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use this
            </button>
          </div>
        </StepShell>
      )}
      {step > 7 && answers.style && (
        <UserBubble>
          {answers.style === "dark" ? "Dark & Modern" : answers.style === "light" ? "Light & Clean" : "Let Ostrix decide"}
          {answers.styleNote ? ` — ${answers.styleNote}` : ""}
        </UserBubble>
      )}

      {/* Step 8 */}
      {step === 8 && (
        <StepShell stepKey={8}>
          <OstrixBubble>Have a website you like? Upload a screenshot and Ostrix will match its style.</OstrixBubble>
          {answers.screenshot ? (
            <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-bg-elevated p-1.5 pr-2">
              <img src={answers.screenshot.preview} alt="Reference" className="h-10 w-10 rounded object-cover" />
              <span className="text-xs text-text-secondary">Reference attached</span>
              <button onClick={() => setAnswers((a) => ({ ...a, screenshot: null }))} className="text-text-muted hover:text-text-primary" aria-label="Remove">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-fit items-center gap-2 rounded-xl border border-dashed border-border bg-bg-elevated px-4 py-2.5 text-sm text-text-secondary hover:border-accent hover:text-text-primary"
            >
              <Paperclip className="h-4 w-4" /> Upload a screenshot
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleScreenshot(file);
            }}
          />
          <button onClick={() => goTo(9)} className="self-start rounded-xl bg-accent px-4 py-2 text-sm font-medium text-black">
            Continue
          </button>
        </StepShell>
      )}
      {step > 8 && <UserBubble>{answers.screenshot ? "Reference screenshot attached" : "Skipped"}</UserBubble>}

      {/* Step 9 — summary */}
      {step === 9 && (
        <StepShell stepKey={9}>
          <OstrixBubble>Here&apos;s your website brief — review before I start building:</OstrixBubble>
          <div className="flex max-w-[560px] flex-col gap-2.5 rounded-xl border border-border bg-bg-surface p-5">
            <p className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Website Brief Summary</p>
            <SummaryRow label="Category" value={answers.category?.label || "—"} />
            <SummaryRow label="Business" value={answers.businessName} />
            <SummaryRow label="Location" value={answers.location} />
            <SummaryRow label="Services" value={answers.services} />
            <SummaryRow label="Phone" value={answers.phone} />
            <SummaryRow label="Email" value={answers.email} />
            <SummaryRow label="WhatsApp" value={whatsappValue || "—"} />
            <SummaryRow label="Features" value={answers.features.length ? answers.features.join(", ") : "None"} />
            <SummaryRow
              label="Style"
              value={
                (answers.style === "dark" ? "Dark & Modern" : answers.style === "light" ? "Light & Clean" : "Let Ostrix decide") +
                (answers.styleNote ? ` — ${answers.styleNote}` : "")
              }
            />
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={editAgain}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-text-secondary hover:border-accent hover:text-text-primary"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={generate}
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-medium text-black shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Rocket className="h-3.5 w-3.5" /> Generate Website
              </button>
            </div>
          </div>
        </StepShell>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-20 shrink-0 text-text-muted">{label}</span>
      <span className="flex-1 text-text-primary">{value || "—"}</span>
    </div>
  );
}
