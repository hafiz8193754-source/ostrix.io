import Link from "next/link";

import { BRAND } from "@/lib/brand";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg-base px-6 text-center">
      <OstrixLogo size="lg" layout="column" />
      <div>
        <p className="mx-auto max-w-md text-base text-text-secondary">
          {BRAND.tagline} Describe a website and get it built and deployed — or send a soil photo and get a full
          season farm plan.
        </p>
        <p className="mt-2 text-sm text-text-muted">{BRAND.urdu}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/studio">Open the studio</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
