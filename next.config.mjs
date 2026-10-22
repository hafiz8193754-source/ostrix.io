/** @type {import('next').NextConfig} */
const nextConfig = {
  // Puppeteer (Prompt Engineer's URL scraper) launches a native Chromium
  // binary at runtime — it must stay a plain Node require, not get bundled
  // into the server's webpack output.
  experimental: {
    serverComponentsExternalPackages: ["puppeteer"],
  },
};
export default nextConfig;
