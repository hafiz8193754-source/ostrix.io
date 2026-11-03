/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

export function DoctorAvatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  const initials = name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  if (url) return <img src={url} alt={`Photo of ${name}`} className={cn("shrink-0 rounded-full object-cover", className)} />;
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent", className)}>
      {initials || "Dr"}
    </span>
  );
}
