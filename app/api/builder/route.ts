import { readFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import { complete, streamComplete, type AiContent } from "@/lib/ai";
import { getUserFromRequest, checkQuota, recordGeneration } from "@/lib/serverAuth";
import { builderBriefSchema } from "@/lib/schemas";
import { parseProject } from "@/lib/siteFiles";
import { DESIGN_SYSTEMS, classificationToCategory } from "@/lib/designSystems";
import { runSandboxPass } from "@/lib/sandbox";
import { EXAMPLE_HTML, EXAMPLE_CSS, EXAMPLE_JS } from "@/lib/exampleSite";
import { ProjectStreamParser, friendlyFileLabel } from "@/lib/streamingProject";

export const maxDuration = 300;

// Read once at module load (cold start), not per request.
const SKELETON_CSS = readFileSync(join(process.cwd(), "lib", "designSkeleton.css"), "utf-8");

// Base prompt. MULTI-PAGE, BACKEND API FILES, and the screenshot-analysis
// paragraph are carried over from the previous prompt version — they aren't
// part of the new skeleton/example spec, but dropping them would regress
// multi-page generation (a bug fixed in the previous round) and reference-
// image handling. Placeholders below are filled in by FINAL_SYSTEM.
const SYSTEM = `You are an elite web developer inside Ostrix. Every site you generate is judged against professional agency standards — the user is paying for this and comparing your output to work they'd get from a design studio. A generic Bootstrap-looking page is a failure. You will be given a CSS design skeleton and an example site — your output must match or exceed that quality level.

CRITICAL RULES:

Your styles.css must START with the design skeleton CSS provided below. Then add custom property overrides and any site-specific styles after it.
Your HTML must use the skeleton's class names (.nav, .hero, .container, .section, .card, .btn-primary, .grid-3, .reveal, etc.) — do NOT invent new layout classes.
Study the example restaurant site provided below carefully. Match its structural quality, content depth, and interaction polish in every site you build — regardless of industry.

DESIGN SKELETON CSS (include this at the start of every styles.css you generate):
[SKELETON_CSS will be injected here]

EXAMPLE OF EXCELLENT OUTPUT (a restaurant site — study the patterns, not the content):
=== index.html ===
[EXAMPLE_HTML injected here]
=== styles.css ===
[EXAMPLE_CSS injected here]
=== script.js ===
[EXAMPLE_JS injected here]

Now generate the user's requested site following these standards.

Output format — no markdown fences, no commentary between or around files:
===META name='slug' summary='one sentence'===
===FILE: index.html===
(complete file using skeleton classes)
===FILE: styles.css===
(design skeleton CSS FIRST, then :root overrides with site-appropriate colors, then any additional site-specific styles)
===FILE: script.js===
(complete file — must include at minimum: mobile menu, smooth scroll, scroll reveal, active nav, and any feature the brief implies)
===END===

COLOR PALETTE — derive professional colors from the business type:

Restaurant/food: warm browns, cream, gold accents
Tech/SaaS: deep navy, electric blue, clean white
Creative/portfolio: near-black, warm white, single bold accent
Health/clinic: clean white, calm teal, soft green
Retail/shop: bold primary brand color, neutral grays, warm accent
Service business: trustworthy blue, clean white, orange accent

REQUIRED SECTIONS (every site):

Sticky nav with working mobile hamburger
Hero with benefit-focused headline, subtitle, and CTA buttons
Social proof (stats, logos, or testimonials)
Features/services grid (3 or 4 items with icons)
About/story section
CTA band with contrasting background
Contact section with working validated form
Footer (4-column on desktop): navigation, contact details, social links, copyright

IMAGES AND VIDEO — MANDATORY, never skip this:
Never output an empty image container, a gray placeholder box, or a broken src. Every image uses an Unsplash source URL:

    https://source.unsplash.com/1600x900/?restaurant,interior
    https://source.unsplash.com/800x600/?business,team

Match keywords to the actual section content (the business type and what that section is about) — never generic/unrelated keywords. Use varied dimensions appropriate to each slot: hero 1600x900, cards/features 800x600, thumbnails/avatars 400x400. For video sections, embed a relevant Pexels or YouTube video (iframe embed) — never a blank frame. Every image gets a descriptive, specific alt attribute (not "image" or the filename).

CONTENT — generate real, specific, compelling content:

Business names that sound real and match the brief
Real Pakistani addresses, phone numbers, emails where appropriate
Benefit-focused headlines (not generic 'Welcome to Our Site')
Specific service/product descriptions with details
Testimonials with realistic Pakistani names
Never use Lorem ipsum or "Your headline here" — empty scaffolding is not a deliverable

JAVASCRIPT — every site must have these working:

Mobile hamburger menu with overlay and body scroll lock
Smooth scroll on nav click
Intersection Observer scroll-reveal on all .reveal elements
Active nav link highlight on scroll
Contact form validation with inline error messages
Plus any feature the brief implies (gallery, filter, accordion, carousel, counter)

TECHNICAL — every site must also include:

Semantic HTML5 with accessible landmarks and a proper heading hierarchy
SEO: a descriptive <title>, meta description, and Open Graph tags (og:title, og:description, og:type, og:image using an Unsplash URL) in every page's <head>
A favicon: an inline SVG data-URI <link rel="icon"> in every page's <head> — a simple monogram or icon matching the brand, no separate file needed
Color contrast meeting WCAG AA on every text/background pairing
A styled 404.html (friendly message, link back home) matching the rest of the site's design system, generated for every site

QUALITY CHECK before outputting: Is the hero visually striking? Does the color palette feel intentional and professional? Is there clear typographic hierarchy? Does the mobile nav work? Are there at least 4 working JS interactions? Do all .reveal elements have staggered delays? Does every image use a real, content-matched Unsplash URL? If not, revise.

MULTI-PAGE — for any site where the brief implies more than one page, generate:
index.html (Home), about.html (About us), contact.html (Contact with working form), and additional pages specific to the business (menu.html for restaurant, services.html for service business, etc.). All pages share styles.css and script.js and must use the skeleton's class names exactly like index.html. Navigation links between pages use relative hrefs.

BACKEND API FILES — generate when the brief implies:
Contact/inquiry form → api/contact.js: validate all fields, sanitize input, return JSON, include a comment showing how to wire Nodemailer. Booking system → api/booking.js: date validation, conflict checking logic, return confirmation. Newsletter signup → api/newsletter.js: email validation, duplicate check pattern. Each api file must be a valid Vercel serverless function: export default function handler(req, res).

If the user provides a screenshot or image of a website: analyze its layout grid, color palette, typography choices, section structure, and overall aesthetic. Then recreate and improve upon that design using the skeleton classes above — keep what works, fix what doesn't, add missing professional touches.

When you finish, after the ===END=== marker, write two or three sentences summarizing what you built. Do not narrate what you're doing between individual files while you generate them — the file content is the only thing that belongs inside each ===FILE:=== block.`;

// Built once at module load — the placeholders each appear exactly once, and
// a replacer function (rather than a plain string) sidesteps the special
// $-pattern handling String.replace applies to string replacement arguments.
const FINAL_SYSTEM = SYSTEM.replace("[SKELETON_CSS will be injected here]", () => SKELETON_CSS)
  .replace("[EXAMPLE_HTML injected here]", () => EXAMPLE_HTML)
  .replace("[EXAMPLE_CSS injected here]", () => EXAMPLE_CSS)
  .replace("[EXAMPLE_JS injected here]", () => EXAMPLE_JS);

const CSS_REVIEWER_SYSTEM = `You are a senior UI/UX designer who reviews CSS for professional quality. You will receive a generated stylesheet. Improve it for:
1. Visual hierarchy — are headings, subheadings, and body text clearly differentiated?
2. Spacing consistency — is the 8px grid followed? Are sections evenly spaced?
3. Color sophistication — do the colors work together harmoniously? Is contrast accessible?
4. Hover/transition polish — do all interactive elements have smooth, intentional transitions?
5. Mobile quality — does the mobile layout feel intentional, not just stacked?
Keep all existing class names identical. Return ONLY the improved CSS, nothing else.`;

// Fast, cheap pre-pass so the main generation gets a matched font/color/section
// brief instead of guessing a business category from scratch.
async function classifyBrief(brief: string) {
  try {
    const word = await complete({
      system: "Reply with exactly one word from: restaurant, portfolio, service, ecommerce, tech, health",
      content: brief,
      maxTokens: 10,
    });
    return classificationToCategory(word);
  } catch {
    return "tech" as const;
  }
}

// Reviews the (skeleton-included) stylesheet for hierarchy/spacing/color/
// transition/mobile polish. Falls back to the original CSS on any failure so
// a refinement hiccup never breaks the whole generation.
async function refineCss(css: string): Promise<string> {
  try {
    const raw = await complete({ system: CSS_REVIEWER_SYSTEM, content: css, maxTokens: 12000 });
    const cleaned = raw.replace(/```[a-z]*\n?|```/gi, "").trim();
    return cleaned || css;
  } catch {
    return css;
  }
}

function sseFrame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Streams the build live — status/file-start/file-delta/file-done as the
// model writes, then a final done event once the CSS review + sandbox
// passes (unchanged from before) finish. Auth/quota/validation failures
// happen before any bytes are sent, so those stay plain JSON error
// responses; anything that fails once streaming has started becomes an
// `error` SSE frame instead (the HTTP status is already committed by then).
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Please sign in.", 401);

  const limit = parseInt(process.env.FREE_DAILY_BUILDS || "3", 10);
  const quota = await checkQuota(user.id, "builder", limit);
  if (!quota.allowed) return jsonError(`Daily free limit reached (${limit} builds). Try again tomorrow.`, 429);

  const body = await request.json();
  const parsed = builderBriefSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid request.", 400);
  const { brief, screenshot } = parsed.data;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseFrame(event, data)));

      try {
        send("status", { message: "Planning structure…" });
        const category = await classifyBrief(brief);
        const ds = DESIGN_SYSTEMS[category];
        const enrichedBrief = `${brief}

--- Design system to apply ---
${ds.context}
Fonts: ${ds.displayFont} (display) + ${ds.bodyFont} (body) — link via: ${ds.fontUrl}
Palette: primary ${ds.primaryColor}, secondary ${ds.secondaryColor}, accent ${ds.accentColor}, background ${ds.bgColor}, text ${ds.textColor}
Hero style: ${ds.heroStyle}. Animation feel: ${ds.animationStyle}.
Suggested section order: ${ds.sectionOrder.join(" → ")}.`;

        const content: AiContent = screenshot?.data
          ? [
              { type: "image", source: { type: "base64", media_type: screenshot.type || "image/png", data: screenshot.data } },
              { type: "text", text: enrichedBrief },
            ]
          : enrichedBrief;

        const parser = new ProjectStreamParser();
        const raw = await streamComplete({ system: FINAL_SYSTEM, content, maxTokens: 64000 }, (event) => {
          if (event.type !== "token") return;
          for (const evt of parser.feed(event.text)) {
            if (evt.type === "file-start") {
              send("file-start", { path: evt.path });
              send("status", { message: `${friendlyFileLabel(evt.path)}…` });
            } else if (evt.type === "file-delta") {
              send("file-delta", { path: evt.path, chunk: evt.chunk });
            } else if (evt.type === "file-done") {
              send("file-done", { path: evt.path, content: evt.content });
            }
          }
        });

        const site = parseProject(raw, brief);

        send("status", { message: "Reviewing design…" });
        const cssFile = site.files.find((f) => f.path === "styles.css");
        if (cssFile) {
          // Safety net: the model sometimes ignores the "start with the skeleton"
          // instruction. Prepend it automatically so quality never depends on
          // the model remembering — then run the design-review pass on top.
          if (!cssFile.content.includes("--space-1:")) {
            cssFile.content = `${SKELETON_CSS}\n\n/* === Site-specific styles === */\n\n${cssFile.content}`;
          }
          cssFile.content = await refineCss(cssFile.content);
          send("file-done", { path: "styles.css", content: cssFile.content });
        }

        send("status", { message: "Testing in the sandbox…" });
        const sandbox = await runSandboxPass(site.files);
        site.files = sandbox.files;

        await recordGeneration(user.id, "builder", { name: site.name, files: site.files.map((f) => f.path), category });
        send("done", {
          site,
          sandboxPreviewUrl: sandbox.sandboxPreviewUrl,
          sandboxErrors: sandbox.sandboxErrors,
          sandboxLogs: sandbox.sandboxLogs,
          remaining: Math.max(0, quota.limit - quota.used - 1),
        });
      } catch (e) {
        send("error", { message: (e as Error).message || "Generation failed — please try again with a slightly more specific brief." });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
