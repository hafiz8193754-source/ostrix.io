import { NextResponse } from "next/server";
import { verifyTwilioRequest } from "@/lib/twilio";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] || c);
}

function xmlResponse(body: string) {
  return new NextResponse(body, { headers: { "content-type": "text/xml" } });
}

// Twilio fetches this once per leg (doctor + patient) right after the call
// connects. Plays the consent/recording notice both parties must hear before
// the spec's "record-from-start" conference recording begins, then joins the
// shared conference — same conference name for both legs, so they end up
// talking to each other without either side seeing the other's real number.
export async function POST(request: Request) {
  const { valid } = await verifyTwilioRequest(request);
  if (!valid) {
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>This call could not be verified.</Say><Hangup/></Response>`);
  }

  const { searchParams } = new URL(request.url);
  const conference = searchParams.get("conference") || "";
  const consultation = searchParams.get("consultation") || "";
  const token = searchParams.get("token") || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";

  if (!conference) {
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, this consultation could not be found.</Say><Hangup/></Response>`);
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This call will be recorded for medical record and quality purposes. By staying on the line, you consent to recording. Connecting you now.</Say>
  <Dial>
    <Conference
      statusCallback="${escapeXml(`${appUrl}/api/doctor/call/status?consultation=${consultation}${tokenQuery}`)}"
      statusCallbackEvent="start end join leave"
      recordingStatusCallback="${escapeXml(`${appUrl}/api/doctor/call/recording?consultation=${consultation}${tokenQuery}`)}"
      record="record-from-start"
      endConferenceOnExit="true"
    >${escapeXml(conference)}</Conference>
  </Dial>
</Response>`;

  return xmlResponse(twiml);
}
