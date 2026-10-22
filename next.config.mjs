/** @type {import('next').NextConfig} */
const nextConfig = {
  // Puppeteer (Prompt Engineer's URL scraper) launches a native Chromium
  // binary at runtime — it must stay a plain Node require, not get bundled
  // into the server's webpack output.
  experimental: {
    serverComponentsExternalPackages: ["puppeteer"],
  },
  // Old admin URLs live on as tabs of the /admin hub. Sent as real 307s with
  // a Location header (the page-level redirects stay as a fallback).
  async redirects() {
    return [
      { source: "/admin/doctors", destination: "/admin?tab=doctors", permanent: false },
      { source: "/admin/payments", destination: "/admin?tab=payments", permanent: false },
    ];
  },
};
export default nextConfig;
