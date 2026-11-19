import { hasServiceRoleKey, requireServiceClient } from "@/lib/serverAuth";

type Bucket = { hits: number; start: number };

const memory = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

function memoryHit(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const current = memory.get(key);
  if (!current || now - current.start >= windowMs) {
    memory.set(key, { hits: 1, start: now });
    return { ok: true };
  }
  if (current.hits >= limit) {
    return { ok: false, retryAfter: Math.ceil((current.start + windowMs - now) / 1000) };
  }
  current.hits += 1;
  return { ok: true };
}

async function tableHit(key: string, limit: number, windowSec: number, now: number): Promise<RateLimitResult | null> {
  if (!hasServiceRoleKey()) return null;
  try {
    const db = requireServiceClient();
    const { data, error } = await db.from("api_rate_limits").select("hits, window_start").eq("bucket", key).maybeSingle();
    if (error) return null;
    const startMs = data?.window_start ? new Date(data.window_start as string).getTime() : 0;
    const fresh = !data || now - startMs >= windowSec * 1000;
    const hits = fresh ? 1 : Number(data.hits) + 1;
    const windowStart = fresh ? new Date(now).toISOString() : (data.window_start as string);
    if (!fresh && Number(data.hits) >= limit) {
      return { ok: false, retryAfter: Math.max(1, Math.ceil((startMs + windowSec * 1000 - now) / 1000)) };
    }
    const { error: writeError } = await db.from("api_rate_limits").upsert({ bucket: key, hits, window_start: windowStart });
    if (writeError) return null;
    return { ok: true };
  } catch {
    return null;
  }
}

export async function enforceRateLimit(
  request: Request,
  opts: { name: string; limit: number; windowSec: number; userId?: string | null },
  now = Date.now()
): Promise<RateLimitResult> {
  const keys = [`${opts.name}:ip:${clientIp(request)}`];
  if (opts.userId) keys.push(`${opts.name}:user:${opts.userId}`);
  for (const key of keys) {
    const durable = await tableHit(key, opts.limit, opts.windowSec, now);
    const result = durable ?? memoryHit(key, opts.limit, opts.windowSec * 1000, now);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export function rateLimited(result: RateLimitResult): Response | null {
  if (result.ok) return null;
  return new Response(JSON.stringify({ error: "Too many requests. Please wait and try again." }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(result.retryAfter) },
  });
}

export function resetRateLimitMemory(): void {
  memory.clear();
}
