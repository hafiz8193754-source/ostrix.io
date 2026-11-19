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
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.x.ai https://api.twilio.com https://*.twilio.com https://nominatim.openstreetmap.org",
      "media-src 'self' blob: mediastream:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
