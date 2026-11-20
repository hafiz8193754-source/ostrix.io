"use client";

import { Menu, Stethoscope } from "lucide-react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { NotificationBell } from "@/components/NotificationBell";

interface TopNavProps {
  onToggleSidebar: () => void;
  accessToken?: string;
}

export function TopNav({ onToggleSidebar, accessToken }: TopNavProps) {
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-bg-surface/80 px-3 backdrop-blur sm:px-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated md:hidden"
          aria-label="Open chat history"
          aria-controls="chat-history"
        >
          <Menu className="h-5 w-5" />
          History
        </button>
        <OstrixLogo size="sm" withWordmark />
      </div>

      <div className="hidden items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs font-medium text-text-secondary sm:flex">
        <Stethoscope className="h-3.5 w-3.5" />
        Assistant Doctor
      </div>

      <div className="flex items-center gap-2">{accessToken && <NotificationBell accessToken={accessToken} />}</div>
    </header>
  );
}
