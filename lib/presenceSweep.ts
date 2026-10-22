import { sweepStalePresence, sweepExpiredPmdc, warnExpiringPmdc, drainNotifyRequests } from "@/lib/clinical";
import { hasServiceRoleKey } from "@/lib/serverAuth";

// Shared by every call site that should trigger a sweep (patient search,
// admin panel load, the dedicated sweep endpoint) so they all respect the
// same in-memory throttle instead of each keeping their own clock — there's
// no cron in this app, so this is deliberately opportunistic.
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

export interface SweepResult {
  skipped: boolean;
  staleCount?: number;
  expiredCount?: number;
  warnedCount?: number;
  notifiedCount?: number;
}

export async function runPresenceSweep(): Promise<SweepResult> {
  // Called opportunistically from user routes (symptom search, dashboard).
  // Without the service role there is nothing this sweep can do under RLS,
  // and it must not fail the request that triggered it.
  if (!hasServiceRoleKey()) return { skipped: true };
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return { skipped: true };
  lastSweepAt = now;

  const [staleCount, expiredCount, warnedCount, notifiedCount] = await Promise.all([
    sweepStalePresence(),
    sweepExpiredPmdc(),
    warnExpiringPmdc(),
    drainNotifyRequests(),
  ]);

  return { skipped: false, staleCount, expiredCount, warnedCount, notifiedCount };
}
