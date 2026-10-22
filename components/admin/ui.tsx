"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Small shared building blocks for the admin dashboard.

export function initials(name: string) {
  const parts = (name || "").replace(/^dr\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export function InitialsAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-glow font-display font-bold text-accent ${cls}`}
    >
      {initials(name)}
    </span>
  );
}

const TONES = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  blue: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  gray: "border-border bg-bg-elevated text-text-secondary",
} as const;
export type Tone = keyof typeof TONES;

export const STATUS_TONE: Record<string, Tone> = {
  pending: "amber",
  under_review: "blue",
  verified: "green",
  approved: "green",
  rejected: "red",
  suspended: "gray",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONES[STATUS_TONE[status] || "gray"];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label || status.replace(/_/g, " ")}
    </span>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      aria-label={copied ? "Copied" : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-muted hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  size = "sm",
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="inline-flex gap-1 rounded-xl border border-border bg-bg-elevated p-1">
        {items.map((t) => {
          const active = value === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs"
              } ${active ? "bg-bg-surface text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`min-w-[1.25rem] rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums ${
                    active ? "bg-accent text-accent-fg" : "bg-bg-overlay text-text-secondary"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-bg-elevated ${className}`} />;
}

export function RowSkeletons({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-bg-surface shadow-card p-3.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-bg-surface px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {hint && <p className="max-w-xs text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
