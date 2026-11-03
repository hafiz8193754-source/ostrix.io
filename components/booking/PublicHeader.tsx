import Link from "next/link";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { BRAND } from "@/lib/brand";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg-base/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <OstrixLogo size="sm" withWordmark />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/doctors" className="rounded-lg px-3 py-2 font-medium text-text-secondary hover:text-text-primary">Doctors</Link>
          <Link href="/my-care" className="rounded-lg px-3 py-2 font-medium text-text-secondary hover:text-text-primary">My care</Link>
        </nav>
      </div>
    </header>
  );
}
