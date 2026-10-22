import puppeteer from "puppeteer";

export interface UrlScrapeResult {
  title: string;
  headings: string[];
  sections: string[];
  colors: string[];
  fonts: string[];
  screenshot: { data: string; mediaType: string };
}

const MAX_FULLPAGE_HEIGHT = 6000;

// Blocks the obvious SSRF targets before Puppeteer ever navigates — this
// route lets any signed-in user make the server fetch an arbitrary URL.
// Best-effort (hostname-pattern check, not a DNS-rebinding-proof resolver),
// but it stops the naive cases: localhost, loopback, and private IP literals.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /\.local$/i,
];

export function assertScrapableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http/https links can be loaded.");
  if (BLOCKED_HOST_PATTERNS.some((p) => p.test(url.hostname))) throw new Error("That address can't be loaded.");
  return url;
}

function rgbToHex(rgb: string): string | null {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; // fully transparent
  const [r, g, b] = [m[1], m[2], m[3]].map((n) => parseInt(n, 10));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

// Loads a reference page server-side, extracts style/layout direction (never
// the page's actual copy), and grabs a screenshot — both handed to Claude so
// it can describe "the mood and structure of this site" without ever being
// asked to reproduce it verbatim (that instruction lives in the route/system prompt).
export async function scrapeUrl(raw: string): Promise<UrlScrapeResult> {
  const url = assertScrapableUrl(raw);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 20000 });
    // Let late layout/webfont/CSS settle before sampling styles or shooting.
    await new Promise((r) => setTimeout(r, 1200));

    const extracted = await page.evaluate(() => {
      const title = document.title || "";
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
        .slice(0, 25)
        .map((h) => (h.textContent || "").trim())
        .filter(Boolean);
      const sections = Array.from(new Set(Array.from(document.querySelectorAll("header, nav, main, section, footer")).map((el) => el.tagName.toLowerCase())));

      const sampleEls = Array.from(
        document.querySelectorAll('body, h1, h2, a, button, [class*="btn"], [class*="button"], [class*="hero"]')
      ).slice(0, 60);
      const colorSet = new Set<string>();
      const fontSet = new Set<string>();
      for (const el of sampleEls) {
        const cs = getComputedStyle(el as Element);
        if (cs.color) colorSet.add(cs.color);
        if (cs.backgroundColor) colorSet.add(cs.backgroundColor);
        if (cs.fontFamily) fontSet.add(cs.fontFamily.split(",")[0].trim().replace(/["']/g, ""));
      }
      return {
        title,
        headings,
        sections,
        rawColors: Array.from(colorSet),
        fonts: Array.from(fontSet).slice(0, 6),
        scrollHeight: document.body.scrollHeight,
      };
    });

    const colors = Array.from(new Set(extracted.rawColors.map(rgbToHex).filter((c): c is string => !!c))).slice(0, 12);

    const fullPage = extracted.scrollHeight > 0 && extracted.scrollHeight <= MAX_FULLPAGE_HEIGHT;
    const screenshotBuffer = await page.screenshot({ type: "jpeg", quality: 65, fullPage });

    return {
      title: extracted.title,
      headings: extracted.headings,
      sections: extracted.sections,
      colors,
      fonts: extracted.fonts,
      screenshot: { data: Buffer.from(screenshotBuffer).toString("base64"), mediaType: "image/jpeg" },
    };
  } finally {
    await browser.close();
  }
}
