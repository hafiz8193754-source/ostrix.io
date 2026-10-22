"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { Profile } from "@/types";
import type { ProfilePatch } from "./SettingsModal";

interface ApiKeysSectionProps {
  profile: Profile | null;
  onSave: (patch: ProfilePatch) => Promise<boolean>;
}

const PROVIDERS = [
  { key: "anthropic", label: "Anthropic (Claude)" },
  { key: "openai", label: "OpenAI" },
  { key: "vercel", label: "Vercel (deploy)" },
];

export function ApiKeysSection({ profile, onSave }: ApiKeysSectionProps) {
  const [values, setValues] = useState<Record<string, string>>(profile?.settings.apiKeys || {});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);

  async function save(key: string) {
    const ok = await onSave({ settings: { apiKeys: { ...(profile?.settings.apiKeys || {}), [key]: values[key] || "" } } });
    if (ok) {
      setSaved(key);
      setTimeout(() => setSaved(null), 1500);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">
        Saved to your account, masked here. Ostrix's agents currently run on the platform's own keys — per-user keys aren't wired
        into any agent call yet, so adding one here doesn't change billing or usage today.
      </p>
      {PROVIDERS.map((p) => (
        <div key={p.key}>
          <label className="mb-1 block text-xs font-medium text-text-secondary">{p.label}</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={visible[p.key] ? "text" : "password"}
                value={values[p.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
                placeholder="sk-…"
                className="h-9 w-full rounded-md border border-border bg-bg-elevated px-3 pr-9 text-sm text-text-primary outline-none focus-visible:border-accent"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [p.key]: !v[p.key] }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                aria-label={visible[p.key] ? "Hide key" : "Show key"}
              >
                {visible[p.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button onClick={() => save(p.key)} className="h-9 shrink-0 rounded-md bg-accent px-3 text-xs font-medium text-black">
              {saved === p.key ? "Saved" : "Save"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
