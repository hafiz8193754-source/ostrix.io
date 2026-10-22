import type { ProfileSettings } from "@/types";

export type ResolvedTheme = "dark" | "light";
export type ThemePreference = NonNullable<ProfileSettings["theme"]>;

const COOKIE_NAME = "ostrix-theme-pref";

export function resolveTheme(pref: ThemePreference | undefined): ResolvedTheme {
  if (pref === "dark" || pref === "light") return pref;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

// Applies the resolved theme to <html data-theme> and remembers the raw
// preference (not the resolved value) in a small non-chat UI-preference
// cookie so the blocking inline script in app/layout.tsx can apply it again
// before the next page paints, avoiding a flash of the wrong theme.
export function applyTheme(pref: ThemePreference | undefined): void {
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
  document.cookie = `${COOKIE_NAME}=${pref || "system"}; path=/; max-age=31536000; samesite=lax`;
}

// Keeps the applied theme in sync with the OS while preference is "system".
export function watchSystemTheme(pref: ThemePreference | undefined, onChange: () => void): () => void {
  if (pref === "dark" || pref === "light") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
