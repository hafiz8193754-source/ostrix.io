"use client";

import { Menu, Sparkles, Globe, Sprout, Stethoscope } from "lucide-react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { NotificationBell } from "@/components/NotificationBell";
import type { AgentMode } from "@/types";

interface TopNavProps {
  mode: AgentMode;
  onToggleSidebar: () => void;
  accessToken?: string;
}

const MODE_LABEL: Record<AgentMode, string> = {
  prompt_engineer: "Prompt Engineer",
  builder: "Website Builder",
  farm: "Farming Advisor",
  doctor: "Assistant Doctor",
};

const MODE_ICON: Record<AgentMode, typeof Sparkles> = {
  prompt_engineer: Sparkles,
  builder: Globe,
  farm: Sprout,
  doctor: Stethoscope,
};

// "New Chat" now lives only in the Sidebar — no redundant copy up here.
export function TopNav({ mode, onToggleSidebar, accessToken }: TopNavProps) {
  const ModeIcon = MODE_ICON[mode];

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-bg-surface px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
        <OstrixLogo size="sm" withWordmark />
      </div>

      <div className="hidden items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs font-medium text-text-secondary sm:flex">
        <ModeIcon className="h-3.5 w-3.5" />
        {MODE_LABEL[mode]}
      </div>

      <div className="flex items-center gap-2">{accessToken && <NotificationBell accessToken={accessToken} />}</div>
    </header>
  );
}
