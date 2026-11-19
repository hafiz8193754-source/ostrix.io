import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { BRAND } from "@/lib/brand";
import { siteUrl } from "@/lib/site";
import { WhatsAppButton } from "@/components/brand/WhatsAppButton";
import { TooltipProvider } from "@/components/ui/tooltip";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

const DESCRIPTION = `${BRAND.name}: talk through symptoms, book a verified doctor, and receive a signed prescription.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s — ${BRAND.name}`,
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: DESCRIPTION,
  },
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

// Hides the WhatsApp button before first paint on visit and dashboard routes.
// Client navigations update the same flag from WhatsAppButton.
const WHATSAPP_SCRIPT = `(function(){try{
  var p=location.pathname.replace(/\\/+$/,"")||"/";
  var hide=p==="/admin"||p.indexOf("/admin/")===0||p==="/visit"||p.indexOf("/visit/")===0||p==="/doctor/dashboard"||p.indexOf("/doctor/dashboard/")===0;
  if(hide) document.documentElement.setAttribute("data-hide-whatsapp","1");
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: WHATSAPP_SCRIPT }} />
      </head>
      <body>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <WhatsAppButton />
      </body>
    </html>
  );
}
