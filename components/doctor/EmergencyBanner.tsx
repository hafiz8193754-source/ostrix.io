"use client";

import { PhoneCall, AlertTriangle } from "lucide-react";
import { EMERGENCY_HOSPITALS, firstAidFor, CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";

interface EmergencyBannerProps {
  matchedKeyword: string | null;
}

export function EmergencyBanner({ matchedKeyword }: EmergencyBannerProps) {
  return (
    <div className="flex max-w-[560px] flex-col gap-4 rounded-2xl border-2 border-red-500 bg-red-500/5 p-5">
      <div className="flex items-center gap-2 text-red-600">
        <AlertTriangle className="h-6 w-6" />
        <h3 className="text-lg font-bold">EMERGENCY DETECTED</h3>
      </div>

      <p className="text-sm text-text-primary">
        Call <strong>1122</strong> (Rescue) immediately or go to the nearest hospital emergency room.
      </p>

      <a
        href="tel:1122"
        className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700"
      >
        <PhoneCall className="h-4 w-4" /> Call 1122 Now
      </a>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">While waiting for help</p>
        <p className="text-sm text-text-secondary">{firstAidFor(matchedKeyword)}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Nearest emergency hospitals in Lahore</p>
        <ul className="flex flex-col gap-1">
          {EMERGENCY_HOSPITALS.map((h) => (
            <li key={h.name} className="flex items-center justify-between text-sm text-text-secondary">
              <span>{h.name}</span>
              <a href={`tel:${h.phone}`} className="font-medium text-accent hover:underline">
                {h.phone}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">
        Do NOT wait for an online consultation in an emergency.
      </p>

      <p className="text-[11px] leading-relaxed text-text-muted">{CLINICAL_DISCLAIMER}</p>
    </div>
  );
}
