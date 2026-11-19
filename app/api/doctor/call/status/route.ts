import { NextResponse } from "next/server";
import { verifyTwilioRequest } from "@/lib/twilio";
import { markCallEnded, logClinicalAudit } from "@/lib/clinical";
import { hasServiceRoleKey, requireServiceClient } from "@/lib/serverAuth";
import { verifyCallState } from "@/lib/callState";

// Handles both the call-level statusCallback (fires once per leg, CallStatus
// "completed") and the conference-level statusCallback (fires on
// start/join/leave/end) — both point here, since Twilio doesn't let one URL
// distinguish itself for two different callback registrations otherwise.
export async function POST(request: Request) {
  const { valid, params } = await verifyTwilioRequest(request);
  if (!valid) return NextResponse.json({ error: "Invalid signature." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const consultationId = searchParams.get("consultation");
  if (!consultationId) return NextResponse.json({ ok: true });
  if (!verifyCallState(searchParams.get("state") || "", consultationId))
    return NextResponse.json({ error: "Invalid call state." }, { status: 401 });
  if (!hasServiceRoleKey()) return NextResponse.json({ error: "Server not fully configured" }, { status: 503 });
  const db = requireServiceClient();

  const callStatus = params.CallStatus;
  const conferenceEvent = params.StatusCallbackEvent;
  const durationRaw = params.CallDuration;
  const duration = durationRaw ? parseInt(durationRaw, 10) : null;

  if (callStatus === "completed" || conferenceEvent === "conference-end") {
    await markCallEnded(db, consultationId, Number.isFinite(duration) ? duration : null);
    await logClinicalAudit(db, consultationId, null, "system", "call_ended", { callStatus, conferenceEvent, duration });
  }

  return NextResponse.json({ ok: true });
}
