import twilio from "twilio";

export function twilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID || "", process.env.TWILIO_AUTH_TOKEN || "");
}

export function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

// Every inbound Twilio webhook (TwiML fetch, status callback, recording
// callback) is public and unauthenticated by necessity — Twilio's own
// X-Twilio-Signature header (HMAC over the exact URL + sorted POST params,
// using TWILIO_AUTH_TOKEN) is the only thing verifying the request actually
// came from Twilio and not something spoofing it.
export async function verifyTwilioRequest(request: Request): Promise<{ valid: boolean; params: Record<string, string> }> {
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const signature = request.headers.get("x-twilio-signature");
  if (!authToken || !signature) return { valid: false, params: {} };

  const params: Record<string, string> = {};
  try {
    const form = await request.clone().formData();
    form.forEach((value, key) => {
      params[key] = String(value);
    });
  } catch {
    // no form body (e.g. a GET) — params stays empty, which is valid for GET requests
  }

  const valid = twilio.validateRequest(authToken, signature, request.url, params);
  return { valid, params };
}
