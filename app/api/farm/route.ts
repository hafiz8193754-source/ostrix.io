import { streamComplete, extractJson } from "@/lib/ai";
import { getUserFromRequest, checkQuota, recordGeneration } from "@/lib/serverAuth";
import { farmIntakeSchema } from "@/lib/schemas";
import type { FarmPlan } from "@/types";

export const maxDuration = 90;

// The interview itself already happened client-side, one question at a time
// (components/farm/FarmIntakeFlow.tsx) — this route receives the complete
// collected answers and produces the four deliverables directly.
const SYSTEM = `You are the Ostrix Farming Advisor, helping farmers in Pakistan.

The interview has already been conducted by the app (one question at a time, in simple language, with voice input in Urdu/Punjabi where needed) — you are receiving the complete collected answers below, plus an optional photo of a problem plant. Do not ask follow-up questions; produce the plan directly from what's given.

DELIVER FOUR THINGS

1. CROP RECOMMENDATION
   Which variety suits their district, soil, water, and the current season.
   Name specific varieties available in Pakistan, with sowing window.

2. DISEASE DIAGNOSIS (when applicable)
   From the description and photo, identify the likely disease or deficiency.
   State your confidence honestly. Give the treatment — specific product type,
   dose per acre, and timing. If the photo is unclear or the symptoms could be
   several things, say so and tell them to consult the local agriculture
   extension officer rather than guessing. If no problem was reported, omit
   this — set "diagnosis" to null.

3. SEASON PLAN
   Month by month from land preparation to harvest: seed rate, fertilizer
   schedule with quantities per acre, irrigation timing, pest watch points,
   harvest window.

4. COST AND REVENUE PROJECTION
   - Costs per acre: seed, DAP, urea, potash, pesticide, ploughing, irrigation,
     labor, harvesting
   - Total investment
   - Expected yield per acre in maunds
   - Current market rate — SEARCH THE WEB FOR THIS, do not guess
   - Gross revenue, net profit, and profit per acre
   State the date and source of every price you use, and warn that rates move.

HONESTY
Never present an uncertain diagnosis as certain. A farmer acting on wrong advice
loses a season's income. When unsure, say so and point to the local extension
office.

Use the web_search tool to find the current market rate (mandi/wholesale price) for the recommended crop, in or near the farmer's district. Never invent a price — if search fails or returns nothing usable, say so plainly in market_rate_source instead of making up a number.

Return ONLY valid JSON, no markdown fences, in this exact shape:
{
  "crop_recommendation": {"crop": "...", "variety": "...", "reasoning": "...", "sowing_window": "..."},
  "diagnosis": null,
  "season_plan": [{"label": "e.g. Month 1 — Land Preparation", "details": "seed rate, fertilizer, irrigation timing, and pest watch points for this period"}],
  "cost_projection": {
    "costs": [{"item": "Seed", "per_acre_pkr": "...", "total_pkr": "..."}],
    "total_investment_pkr": "...",
    "expected_yield_maunds_per_acre": "...",
    "market_rate_pkr_per_maund": "...",
    "market_rate_source": "...",
    "market_rate_date": "...",
    "gross_revenue_pkr": "...",
    "net_profit_pkr": "...",
    "profit_per_acre_pkr": "...",
    "price_caveat": "one line warning that rates move"
  },
  "honesty_note": "one line on overall confidence and what to double check"
}
("diagnosis" above is either null, or {"likely_issue":"...","confidence":"...","treatment":"...","advice":"..."} when a problem was reported.)`;

function sseFrame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return jsonError("Please sign in.", 401);

  const limit = parseInt(process.env.FREE_DAILY_PLANS || "3", 10);
  const quota = await checkQuota(user.id, "farm", limit);
  if (!quota.allowed) return jsonError(`Daily free limit reached (${limit} plans). Try again tomorrow.`, 429);

  const body = await request.json();
  const parsed = farmIntakeSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Please fill in the required details.", 400);
  const { district, landSize, soilType, waterSource, previousCrop, budget, problem, photo } = parsed.data;

  const brief = `District: ${district}, Pakistan
Land size: ${landSize}
Soil type: ${soilType || "not sure"}
Water source: ${waterSource}
Previous crop: ${previousCrop || "none / first season"}
Budget available: ${budget || "not specified"}
Current problem: ${problem || "none reported"}`;

  const content = photo?.data
    ? [
        { type: "image" as const, source: { type: "base64" as const, media_type: photo.type || "image/jpeg", data: photo.data } },
        { type: "text" as const, text: brief },
      ]
    : brief;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseFrame(event, data)));

      send("status", { message: "Reading your details…" });
      let sawTool = false;

      try {
        const raw = await streamComplete(
          { system: SYSTEM, content, maxTokens: 3000, tools: [{ type: "web_search_20250305", name: "web_search" }] },
          (event) => {
            if (event.type === "tool_start" && !sawTool) {
              sawTool = true;
              send("status", { message: "Searching the web for current market rates…" });
            } else if (event.type === "token" && sawTool) {
              sawTool = false;
              send("status", { message: "Preparing your season plan…" });
            }
          }
        );

        const plan = extractJson<FarmPlan>(raw);
        await recordGeneration(user.id, "farm", { district, landSize });
        send("done", { plan, remaining: Math.max(0, quota.limit - quota.used - 1) });
      } catch (e) {
        send("error", { message: (e as Error).message || "Couldn't produce the plan just now — please try again." });
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
