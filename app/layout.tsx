import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { BRAND } from "@/lib/brand";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: `${BRAND.name}: specialist AI agents that build websites and plan farm seasons.`,
};

// Reads the theme-preference cookie (not chat data — a small UI preference,
// the one deliberate exception noted in the shell plan) and sets
// data-theme before first paint, so switching to Dark in Settings never
// flashes light on the next load. Runs before React hydrates, hence the
// inline <script> rather than a useEffect.
const THEME_SCRIPT = `(function(){try{
  var m=document.cookie.match(/(?:^|; )ostrix-theme-pref=([^;]+)/);
  var pref=m?decodeURIComponent(m[1]):"system";
  var resolved=(pref==="dark"||pref==="light")?pref:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
  document.documentElement.setAttribute("data-theme",resolved);
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
