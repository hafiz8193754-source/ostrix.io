import { afterEach, describe, expect, it } from "vitest";

import { signCallState, verifyCallState } from "@/lib/callState";

describe("call state", () => {
  const previous = process.env.CALL_STATE_SECRET;
  afterEach(() => {
    if (previous === undefined) delete process.env.CALL_STATE_SECRET;
    else process.env.CALL_STATE_SECRET = previous;
  });

  it("accepts a signed consultation and rejects a swapped id or a tampered signature", () => {
    process.env.CALL_STATE_SECRET = "test-secret";
    const state = signCallState("consult-1", 60, 1_700_000_000_000);
    expect(verifyCallState(state, "consult-1", 1_700_000_000_000)).toBe(true);
    expect(verifyCallState(state, "consult-2", 1_700_000_000_000)).toBe(false);
    expect(verifyCallState(`${state}x`, "consult-1", 1_700_000_000_000)).toBe(false);
    expect(verifyCallState(state, "consult-1", 1_700_000_000_000 + 120_000)).toBe(false);
  });
});
