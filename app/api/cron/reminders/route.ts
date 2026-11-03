import { NextResponse } from "next/server";

import { hasServiceRoleKey } from "@/lib/serverAuth";
import { twilioConfigured } from "@/lib/twilio";
import { runReminderSweep } from "@/lib/reminders";

export const dynamic = "force-dynamic";

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
// An external scheduler can call it the same way (or ?secret=) more often.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasServiceRoleKey() || !twilioConfigured())
    return NextResponse.json({ error: "Reminders not configured (service role key / Twilio env missing)." }, { status: 503 });
  const totals = await runReminderSweep();
  return NextResponse.json({ ok: true, ...totals });
}
