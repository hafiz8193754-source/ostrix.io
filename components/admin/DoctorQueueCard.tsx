import { MapPin } from "lucide-react";

import { CopyButton, InitialsAvatar, StatusBadge } from "@/components/admin/ui";
import type { Doctor } from "@/types";

interface DoctorQueueCardProps {
  doctor: Doctor;
  selected: boolean;
  onSelect: () => void;
}

export function DoctorQueueCard({ doctor, selected, onSelect }: DoctorQueueCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        selected ? "border-accent bg-accent-glow shadow-sm" : "border-border bg-bg-surface hover:border-accent/50 hover:shadow-sm"
      }`}
    >
      <InitialsAvatar name={doctor.full_name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-text-primary">{doctor.full_name}</p>
          <StatusBadge status={doctor.registration_status} />
        </div>
        <p className="truncate text-xs capitalize text-text-secondary">{doctor.specialization.replace(/_/g, " ")}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-0.5 rounded-md bg-bg-elevated py-0.5 pl-2 pr-0.5 font-mono text-[11px] font-semibold text-text-primary">
            PMDC {doctor.pmdc_number}
            <CopyButton value={doctor.pmdc_number} label="PMDC number" />
          </span>
          {doctor.city && (
            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
              <MapPin className="h-3 w-3" /> {doctor.city}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
