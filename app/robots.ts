import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/studio", "/my-care", "/doctor/", "/visit", "/triage", "/rx", "/welcome", "/api"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
