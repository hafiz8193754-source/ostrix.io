/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import { doctorInitials } from "@/lib/doctorDisplay";

export function DoctorAvatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  const initials = doctorInitials(name);
  if (url) return <img src={url} alt={`Photo of ${name}`} className={cn("shrink-0 rounded-full object-cover", className)} />;
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent", className)}>
      {initials || "Dr"}
    </span>
  );
}
