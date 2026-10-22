import type { Doctor } from "@/types";

interface DoctorQueueCardProps {
  doctor: Doctor;
  selected: boolean;
  onSelect: () => void;
}

export function DoctorQueueCard({ doctor, selected, onSelect }: DoctorQueueCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full flex-col gap-1 rounded-xl border p-3.5 text-left transition-colors ${
        selected ? "border-accent bg-accent-glow" : "border-border bg-bg-surface hover:border-accent/50"
      }`}
    >
      <p className="text-sm font-medium text-text-primary">{doctor.full_name}</p>
      <p className="text-xs text-text-secondary">
        PMDC #{doctor.pmdc_number} · {doctor.specialization.replace(/_/g, " ")}
      </p>
      <p className="text-xs text-text-muted">{doctor.city}</p>
    </button>
  );
}
