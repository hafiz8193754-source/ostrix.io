import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  return process.env.CALL_STATE_SECRET || process.env.CRON_SECRET || process.env.TWILIO_AUTH_TOKEN || "";
}

/** Short-lived proof that this consultation's callbacks were issued by us. Not an access token. */
export function signCallState(consultationId: string, ttlSeconds = 6 * 60 * 60, now = Date.now()): string {
  const key = secret();
  if (!key) throw new Error("Call state secret is not configured.");
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const body = `${consultationId}.${exp}`;
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyCallState(state: string, consultationId: string, now = Date.now()): boolean {
  const key = secret();
  if (!key || !state || !consultationId) return false;
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [id, expRaw, sig] = parts;
  if (id !== consultationId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = createHmac("sha256", key).update(`${id}.${expRaw}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
