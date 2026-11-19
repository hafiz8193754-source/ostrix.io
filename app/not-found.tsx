import Link from "next/link";

import { OstrixLogo } from "@/components/brand/OstrixLogo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mesh px-6 text-center">
      <OstrixLogo size="sm" withWordmark />
      <h1 className="font-display text-3xl font-bold text-text-primary">Page not found</h1>
      <p className="max-w-md text-sm text-text-secondary">That link does not match a page on Ostrix.</p>
      <Link href="/" className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg">
        Back home
      </Link>
    </div>
  );
}
