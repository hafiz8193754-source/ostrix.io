import { describe, expect, it } from "vitest";

import { COMPANY, companyFields, isPlaceholder } from "@/lib/company";

describe("company details", () => {
  it("shows the real contact details and hides an empty company number", () => {
    expect(isPlaceholder).toBe(false);
    expect(COMPANY.companyName).toBe("Ostrix");
    expect(COMPANY.companyNumber).toBe("");
    const labels = companyFields().map((field) => field.label);
    expect(labels).toContain("Email");
    expect(labels).toContain("Phone");
    expect(labels).toContain("Address");
    expect(labels).not.toContain("Company number");
    expect(companyFields().find((field) => field.label === "Email")?.value).toBe("hafiz8193754@gmail.com");
    expect(companyFields().find((field) => field.label === "Phone")?.value).toBe("+447878268504");
  });
});
