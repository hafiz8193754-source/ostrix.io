import { getUserFromRequest } from "@/lib/serverAuth";
import { promptEngineerChatSchema } from "@/lib/schemas";
import { streamClaude, type ClaudeContent, type DocumentBlock, type ImageBlock, type TextBlock } from "@/lib/anthropic";
import { scrapeUrl } from "@/lib/urlScrape";

export const maxDuration = 90;

// The Ostrix Prompt Engineer — a standalone interviewer, not a Website
// Builder handoff. It never builds anything itself; it produces a brief the
// user copies into the Website Builder by hand.
const SYSTEM = `You are the Ostrix Prompt Engineer. Your only job is to interview the user and
produce an exceptional, complete website brief that another AI can build from
without asking a single follow-up question.

INTERVIEW RULES
- Ask ONE question at a time. Never present a wall of questions.
- Give a short example with every question so the user knows what to say.
  ("What is your business name? — for example, Al-Madina Electronics")
- Offer "skip" on every optional question and honor it without pushing.
- Use simple language. Many users are not technical and may not be fluent in English.
- If the user does not know the answer to a design question, propose a sensible
  default and ask them to confirm rather than leaving them stuck.

INFORMATION TO COLLECT
Essential:
1. Business name and what the business actually does
2. Purpose of the site (sell products, generate leads, portfolio, blog, booking, informational)
3. Who the visitors are and what you want them to do
4. Pages needed — if unsure, propose a standard set and confirm
5. Design direction: colors, mood (trustworthy/professional, modern/clean, warm/friendly,
   bold/energetic), any site they like the look of

Optional (offer skip):
6. Logo — accept upload
7. Existing domain and hosting provider
8. Contact details: address, email, phone, WhatsApp
9. Social media links
10. Languages needed
11. Anything specific they want included

ALSO ACCEPT
Uploaded images, PDFs, or a reference URL. Extract everything useful from them
and reduce the number of questions you ask accordingly — never ask for something
the uploaded material already told you.

BEFORE GENERATING
Show a short summary of everything collected and ask the user to confirm or correct it.

THE PROMPT YOU PRODUCE
Write it as a brief to an expert web developer — complete, unambiguous, nothing
left to guess. Structure it under clear headings in this order:
  1. Project overview and purpose
  2. Target audience and primary conversion goal
  3. Site structure — every page listed
  4. Page-by-page content — for EACH page, the actual headline, subheadline,
     section breakdown, and body copy direction. Never just name a page.
  5. Design system — color palette with hex values, font pairing, spacing feel,
     button and card styling, animation level
  6. Technical requirements
  7. Content and assets provided by the user

ADD WHAT THE USER FORGOT
Include these by default even if unmentioned, unless the user declined them:
responsive mobile-first layout, contact form, complete footer with links and
contact details, SEO meta tags and semantic HTML, favicon, 404 page,
accessible color contrast and alt text, fast-loading optimized images.

IMAGES — ALWAYS INCLUDE THIS INSTRUCTION IN EVERY PROMPT YOU GENERATE
Never leave image slots empty or use broken placeholders. Use Unsplash source
URLs in this exact format:

    https://source.unsplash.com/1600x900/?keyword
    https://source.unsplash.com/800x600/?keyword1,keyword2

Choose keywords that match the section's actual subject. For video, embed a
relevant Pexels or YouTube video rather than leaving a blank frame.

OUTPUT
Return the prompt in one clean block ready to copy. No preamble, no commentary
around it. After it, offer: "Want me to change anything before you use this?"

FORMATTING FOR THIS INTERFACE
When — and only when — you reach the OUTPUT step and produce the finished,
ready-to-copy brief, wrap that entire brief (and nothing else) in a fenced
code block tagged "prompt", like this:

\`\`\`prompt
(the full brief goes here)
\`\`\`

Do this every time you output or regenerate the finished brief, including
after a revision request — always the complete brief, never a diff or a
fragment. Never use this fencing for interview questions or the
pre-generation summary; those stay as plain text.`;

function sseFrame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function base64ByteLength(base64: string) {
  return Math.ceil((base64.length * 3) / 4);
}

// Returns a text/event-stream response — event vocabulary: status (a
// request-lifecycle update, e.g. while Puppeteer loads a reference URL),
// token (per text delta), done (final full text, for the client to persist),
// error.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Please sign in.", 401);

  const body = await request.json().catch(() => null);
  const parsed = promptEngineerChatSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid request.", 400);

  const { message, history, attachments, url } = parsed.data;

  for (const a of attachments || []) {
    const bytes = base64ByteLength(a.data);
    if (a.kind === "image" && bytes > MAX_IMAGE_BYTES) return jsonError(`"${a.name || "that image"}" is too large — keep images under 5MB.`, 400);
    if (a.kind === "pdf" && bytes > MAX_PDF_BYTES) return jsonError(`"${a.name || "that file"}" is too large — keep PDFs under 20MB.`, 400);
  }

  const conversationText = (history || []).map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`).join("\n\n");
  const userTurn = message.trim() || (url ? `Please look at this website for reference: ${url}` : "See the attached file(s).");

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseFrame(event, data)));

      const blocks: (TextBlock | ImageBlock | DocumentBlock)[] = [];

      if (url) {
        send("status", { message: "Loading the website you linked…" });
        try {
          const scraped = await scrapeUrl(url);
          const lines = [
            `Reference website: ${url}`,
            scraped.title ? `Title: ${scraped.title}` : "",
            scraped.headings.length ? `Headings found: ${scraped.headings.join(" | ")}` : "",
            scraped.sections.length ? `Layout landmarks detected: ${scraped.sections.join(", ")}` : "",
            scraped.colors.length ? `Colors sampled from the page: ${scraped.colors.join(", ")}` : "",
            scraped.fonts.length ? `Fonts detected: ${scraped.fonts.join(", ")}` : "",
            "A screenshot of this site follows. Use this and the details above only to understand style direction, mood, and layout patterns for the new brief — never reproduce this site's text or design verbatim.",
          ].filter(Boolean);
          blocks.push({ type: "text", text: lines.join("\n") });
          blocks.push({ type: "image", source: { type: "base64", media_type: scraped.screenshot.mediaType, data: scraped.screenshot.data } });
        } catch (e) {
          blocks.push({
            type: "text",
            text: `(Could not automatically load ${url}: ${(e as Error).message} — ask the user to briefly describe that site's look and layout instead, or offer to try again.)`,
          });
        }
      }

      for (const a of attachments || []) {
        if (a.kind === "image") {
          blocks.push({ type: "text", text: `Uploaded image${a.name ? ` (${a.name})` : ""}:` });
          blocks.push({ type: "image", source: { type: "base64", media_type: a.mediaType, data: a.data } });
        } else {
          blocks.push({ type: "text", text: `Uploaded PDF${a.name ? ` (${a.name})` : ""}:` });
          blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
        }
      }

      blocks.push({ type: "text", text: conversationText ? `${conversationText}\n\nUser: ${userTurn}` : `User: ${userTurn}` });

      const content: ClaudeContent = blocks;

      send("status", { message: "Thinking…" });
      try {
        const full = await streamClaude({ system: SYSTEM, content, maxTokens: 6000 }, (event) => {
          if (event.type === "token") send("token", { text: event.text });
        });
        send("done", { text: full });
      } catch (e) {
        send("error", { message: (e as Error).message || "Something went wrong." });
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
