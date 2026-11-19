"use client";

import { OstrixLogo } from "@/components/brand/OstrixLogo";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-mesh px-6 text-center">
      <OstrixLogo size="sm" withWordmark />
      <h1 className="font-display text-3xl font-bold text-text-primary">Something went wrong</h1>
      <p className="max-w-md text-sm text-text-secondary">The page could not be loaded. You can try again.</p>
      <button type="button" onClick={() => reset()} className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-fg">
        Try again
      </button>
    </div>
  );
}
