import { describe, expect, it, beforeEach } from "vitest";

import { enforceRateLimit, resetRateLimitMemory } from "@/lib/rateLimit";

describe("rate limit", () => {
  beforeEach(() => resetRateLimitMemory());

  it("limits a caller after the budget for that route", async () => {
    const request = new Request("http://localhost/api/triage", { headers: { "x-forwarded-for": "203.0.113.8" } });
    const opts = { name: "triage", limit: 2, windowSec: 60, userId: "user-1" };
    expect((await enforceRateLimit(request, opts, 1_000)).ok).toBe(true);
    expect((await enforceRateLimit(request, opts, 1_000)).ok).toBe(true);
    const blocked = await enforceRateLimit(request, opts, 1_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});
