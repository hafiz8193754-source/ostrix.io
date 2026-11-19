import { describe, expect, it } from "vitest";

import { cronAuthorized } from "@/lib/cronAuth";

describe("cron auth", () => {
  it("accepts the bearer header and ignores a query-string secret", () => {
    const header = new Request("http://localhost/api/cron/reminders", { headers: { authorization: "Bearer s3cret" } });
    const query = new Request("http://localhost/api/cron/reminders?secret=s3cret");
    expect(cronAuthorized(header, "s3cret")).toBe(true);
    expect(cronAuthorized(query, "s3cret")).toBe(false);
  });
});
