/** @type {import('next').NextConfig} */
const nextConfig = {
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
