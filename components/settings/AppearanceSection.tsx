"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { applyTheme } from "@/lib/theme";
import type { Profile, ProfileSettings } from "@/types";
import type { ProfilePatch } from "./SettingsModal";

interface AppearanceSectionProps {
  profile: Profile | null;
  onSave: (patch: ProfilePatch) => Promise<boolean>;
}

type Theme = NonNullable<ProfileSettings["theme"]>;

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function AppearanceSection({ profile, onSave }: AppearanceSectionProps) {
  const [theme, setTheme] = useState<Theme>(profile?.settings.theme || "system");

  async function select(value: Theme) {
    setTheme(value);
    applyTheme(value); // instant feedback — doesn't wait for the save round-trip
    await onSave({ settings: { theme: value } });
  }

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Theme</h3>
      <div className="flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => select(o.value)}
            className={cn(
              "flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
              theme === o.value ? "border-accent bg-accent-glow text-accent" : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
