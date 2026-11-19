import type { MetadataRoute } from "next";

import { createAnonAuthClient } from "@/lib/serverAuth";
import { listApprovedDoctors } from "@/lib/publicDoctors";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/doctors`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/forgot-password`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const doctors = await listApprovedDoctors(createAnonAuthClient());
    for (const doctor of doctors) {
      pages.push({ url: `${base}/doctors/${doctor.id}`, lastModified: now, changeFrequency: "weekly", priority: 0.7 });
    }
  } catch {
    // A missing database must not take the rest of the sitemap down.
  }
  return pages;
}
