import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui helper: merges conditional class lists and resolves
// conflicting Tailwind utility classes (e.g. "p-2" vs "p-4") deterministically.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
