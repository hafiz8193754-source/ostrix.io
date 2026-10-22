import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { BRAND } from "@/lib/brand";
import { TooltipProvider } from "@/components/ui/tooltip";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: `${BRAND.name}: talk through symptoms, book a verified doctor, and receive a signed prescription.`,
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
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
