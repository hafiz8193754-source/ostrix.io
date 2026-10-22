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
          {BRAND.tagline} Describe your symptoms, book a PMDC-verified doctor, and get a prescription your doctor has signed.
        </p>
        <p className="mt-2 text-sm text-text-muted">{BRAND.urdu}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/studio">Talk to a doctor</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/doctor/register">Register as a doctor</Link>
        </Button>
      </div>
    </div>
  );
}
