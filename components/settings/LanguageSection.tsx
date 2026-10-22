"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Profile, ProfileSettings } from "@/types";
import type { ProfilePatch } from "./SettingsModal";

interface LanguageSectionProps {
  profile: Profile | null;
  onSave: (patch: ProfilePatch) => Promise<boolean>;
}

type Language = NonNullable<ProfileSettings["language"]>;

const OPTIONS: { value: Language; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "ur", label: "Urdu", native: "اردو" },
  { value: "pa", label: "Punjabi", native: "پنجابی" },
];

export function LanguageSection({ profile, onSave }: LanguageSectionProps) {
  const [language, setLanguage] = useState<Language>(profile?.settings.language || "en");
  const [saved, setSaved] = useState(false);

  async function select(value: Language) {
    setLanguage(value);
    const ok = await onSave({ settings: { language: value } });
    setSaved(ok);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-text-primary">UI Language</h3>
      <p className="mb-3 text-xs text-text-muted">
        Saves your preference now. Full interface translation is a separate, larger effort that's coming later — the app stays in
        English until then.
      </p>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => select(o.value)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
              language === o.value ? "border-accent bg-accent-glow text-accent" : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
            )}
          >
            {o.label}
            <span className="text-text-muted">{o.native}</span>
          </button>
        ))}
      </div>
      {saved && <p className="mt-2 text-xs text-emerald-600">Saved.</p>}
    </div>
  );
}
