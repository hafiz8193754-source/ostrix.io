import { SPECIALIZATIONS } from "@/components/doctor/registration/types";

export function doctorName(fullName: string): string {
  return `Dr. ${fullName.replace(/^\s*dr\.?\s+/i, "")}`;
}

export function specialtyLabel(id: string): string {
  const hit = SPECIALIZATIONS.find(([key]) => key === id);
  return hit ? hit[1] : id.replace(/_/g, " ");
}
