"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Profile } from "@/types";
import type { ProfilePatch } from "./SettingsModal";

interface ChatSectionProps {
  accessToken: string;
  profile: Profile | null;
  onSave: (patch: ProfilePatch) => Promise<boolean>;
}

export function ChatSection({ accessToken, profile, onSave }: ChatSectionProps) {
  const [autoTitles, setAutoTitles] = useState(profile?.settings.autoTitles !== false);
  const [confirmingWipe, setConfirmingWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wiped, setWiped] = useState(false);

  async function toggleAutoTitles() {
    const next = !autoTitles;
    setAutoTitles(next);
    await onSave({ settings: { autoTitles: next } });
  }

  async function wipeHistory() {
    setWiping(true);
    try {
      await fetch("/api/account/delete-history", { method: "POST", headers: { authorization: `Bearer ${accessToken}` } });
      setWiped(true);
      setConfirmingWipe(false);
    } catch {
      // best-effort
    }
    setWiping(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm text-text-primary">
        Auto-generate chat titles from the first message
        <input type="checkbox" checked={autoTitles} onChange={toggleAutoTitles} className="h-4 w-4 accent-accent" />
      </label>

      <div className="border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold text-red-500">Delete all chat history</h3>
        {!confirmingWipe ? (
          <button
            onClick={() => setConfirmingWipe(true)}
            className="rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-500 hover:bg-red-500/5"
          >
            Delete all conversations
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3">
            <p className="text-xs text-text-secondary">This permanently deletes every conversation across all agents. This can't be undone.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={wipeHistory}
                disabled={wiping}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {wiping && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete everything
              </button>
              <button onClick={() => setConfirmingWipe(false)} className="text-xs text-text-secondary hover:text-text-primary">
                Cancel
              </button>
            </div>
          </div>
        )}
        {wiped && <p className="mt-2 text-xs text-emerald-600">All chat history deleted. Reload to see the empty sidebar.</p>}
      </div>
    </div>
  );
}
