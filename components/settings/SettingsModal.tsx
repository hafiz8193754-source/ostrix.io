"use client";

import { useState } from "react";
import { User, Palette, Languages, MessageSquare, KeyRound } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AccountSection } from "./AccountSection";
import { AppearanceSection } from "./AppearanceSection";
import { LanguageSection } from "./LanguageSection";
import { ChatSection } from "./ChatSection";
import { ApiKeysSection } from "./ApiKeysSection";
import type { Profile, ProfileSettings } from "@/types";

type Tab = "account" | "appearance" | "language" | "chat" | "apiKeys";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language", icon: Languages },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "apiKeys", label: "API Keys", icon: KeyRound },
];

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  userEmail: string;
  profile: Profile | null;
  onProfileUpdated: (p: Profile) => void;
}

export interface ProfilePatch {
  display_name?: string;
  avatar_url?: string;
  settings?: Partial<ProfileSettings>;
}

export function SettingsModal({ open, onClose, accessToken, userEmail, profile, onProfileUpdated }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>("account");

  async function saveSettings(patch: ProfilePatch): Promise<boolean> {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok && data.profile) onProfileUpdated(data.profile);
    return res.ok;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0">
        <div className="flex h-[560px] max-h-[80vh]">
          <div className="w-44 shrink-0 border-r border-border bg-bg-elevated p-2">
            <p className="px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Settings</p>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  tab === t.id ? "bg-accent-glow text-accent" : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                )}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {tab === "account" && <AccountSection accessToken={accessToken} userEmail={userEmail} profile={profile} onSave={saveSettings} />}
            {tab === "appearance" && <AppearanceSection profile={profile} onSave={saveSettings} />}
            {tab === "language" && <LanguageSection profile={profile} onSave={saveSettings} />}
            {tab === "chat" && <ChatSection accessToken={accessToken} profile={profile} onSave={saveSettings} />}
            {tab === "apiKeys" && <ApiKeysSection profile={profile} onSave={saveSettings} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
