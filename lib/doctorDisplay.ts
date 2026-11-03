import { SPECIALIZATIONS } from "@/components/doctor/registration/types";

const HONORIFIC = /^\s*(?:(?:dr|prof|mr|mrs|ms|miss)\.\s*|(?:dr|prof|mr|mrs|ms|miss)\s+)+/i;

export function stripHonorifics(fullName: string): string {
  return fullName.replace(HONORIFIC, "").trim();
}

export function doctorName(fullName: string): string {
  return `Dr. ${stripHonorifics(fullName)}`;
}

export function doctorInitials(fullName: string): string {
  return stripHonorifics(fullName)
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function specialtyLabel(id: string): string {
  const hit = SPECIALIZATIONS.find(([key]) => key === id);
  return hit ? hit[1] : id.replace(/_/g, " ");
}
