import Link from "next/link";
import type { ReactNode } from "react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { BRAND } from "@/lib/brand";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <OstrixLogo size="sm" withWordmark />
        </Link>
        <Link href="/" className="text-sm text-text-secondary hover:text-accent">
          Home
        </Link>
      </div>
      <header>
        <h1 className="font-display text-4xl font-bold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated {updated}</p>
      </header>
      <article className="flex flex-col gap-6 text-sm leading-relaxed text-text-secondary [&_a]:font-medium [&_a]:text-accent [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-text-primary [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </article>
      <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm text-text-secondary">
        <Link href="/privacy" className="hover:text-accent">Privacy</Link>
        <Link href="/terms" className="hover:text-accent">Terms</Link>
        <Link href="/refund" className="hover:text-accent">Refunds</Link>
        <Link href="/about" className="hover:text-accent">About</Link>
      </nav>
    </div>
  );
}
