import { NextResponse } from "next/server";

import { hasServiceRoleKey } from "@/lib/serverAuth";
import { twilioConfigured } from "@/lib/twilio";
import { runReminderSweep } from "@/lib/reminders";
import { cronAuthorized } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. The secret is not
// accepted in the query string, where it would be written to access logs.

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasServiceRoleKey() || !twilioConfigured())
    return NextResponse.json({ error: "Reminders not configured (service role key / Twilio env missing)." }, { status: 503 });
  const totals = await runReminderSweep();
  return NextResponse.json({ ok: true, ...totals });
}
