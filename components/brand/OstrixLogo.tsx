"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type LogoSize = "xs" | "sm" | "lg";

const ICON_PX: Record<LogoSize, number> = { xs: 20, sm: 28, lg: 96 };
const WORDMARK_CLASS: Record<LogoSize, string> = {
  xs: "text-xs",
  sm: "text-base",
  lg: "text-3xl",
};

export interface OstrixLogoProps {
  size?: LogoSize;
  /** Show the "Ostrix" wordmark next to (row) or under (column) the icon. Icon-only when omitted (e.g. chat avatar). */
  withWordmark?: boolean;
  layout?: "row" | "column";
  className?: string;
}

// Geometric sun mark: rays + a circuit/AI-node core, warm gradient, soft glow.
// A React.useId()-derived gradient id keeps multiple instances on one page
// (nav logo + per-message avatars) from clobbering each other's <defs>.
export function OstrixLogo({ size = "sm", withWordmark = false, layout, className }: OstrixLogoProps) {
  const gradientId = React.useId();
  const px = ICON_PX[size];
  const direction = layout ?? (size === "lg" ? "column" : "row");

  const rays = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <div
      className={cn(
        "inline-flex items-center",
        direction === "column" ? "flex-col gap-3" : "flex-row gap-2",
        className
      )}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        className="shrink-0 drop-shadow-[0_0_8px_var(--accent-glow)]"
        role="img"
        aria-label="Ostrix"
      >
        <defs>
          <linearGradient id={`${gradientId}-grad`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF8C00" />
            <stop offset="100%" stopColor="#FFB800" />
          </linearGradient>
        </defs>

        {rays.map((deg) => (
          <line
            key={deg}
            x1="24"
            y1="24"
            x2="24"
            y2="6"
            stroke={`url(#${gradientId}-grad)`}
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${deg} 24 24)`}
          />
        ))}

        <circle cx="24" cy="24" r="12" fill={`url(#${gradientId}-grad)`} />

        {/* Circuit / AI-node pattern etched into the core */}
        <g stroke="#0A0A0A" strokeWidth="1" strokeLinecap="round" opacity="0.55">
          <line x1="24" y1="17" x2="24" y2="20" />
          <line x1="24" y1="28" x2="24" y2="31" />
          <line x1="17" y1="24" x2="20" y2="24" />
          <line x1="28" y1="24" x2="31" y2="24" />
          <line x1="19" y1="19" x2="21" y2="21" />
          <line x1="27" y1="27" x2="29" y2="29" />
          <line x1="29" y1="19" x2="27" y2="21" />
          <line x1="21" y1="27" x2="19" y2="29" />
        </g>
        <g fill="#0A0A0A">
          <circle cx="24" cy="24" r="2.2" opacity="0.7" />
          <circle cx="24" cy="17" r="1.1" opacity="0.55" />
          <circle cx="24" cy="31" r="1.1" opacity="0.55" />
          <circle cx="17" cy="24" r="1.1" opacity="0.55" />
          <circle cx="31" cy="24" r="1.1" opacity="0.55" />
        </g>
      </svg>

      {withWordmark && (
        <span className={cn("font-display font-bold tracking-tight text-text-primary", WORDMARK_CLASS[size])}>
          Ostrix
        </span>
      )}
    </div>
  );
}
