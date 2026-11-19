import { describe, expect, it } from "vitest";

import { COMPANY, companyFields, isPlaceholder, showWhatsAppButton, whatsappLink } from "@/lib/company";

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
    expect(COMPANY.whatsapp).toBe("+447878268504");
    expect(whatsappLink()).toBe("https://wa.me/447878268504?text=Hi%20Ostrix%2C%20I%20need%20help%20booking%20a%20doctor");
  });

  it("shows the WhatsApp button on public pages and hides it on visits and dashboards", () => {
    expect(showWhatsAppButton("/")).toBe(true);
    expect(showWhatsAppButton("/about")).toBe(true);
    expect(showWhatsAppButton("/doctors")).toBe(true);
    expect(showWhatsAppButton("/doctors/abc")).toBe(true);
    expect(showWhatsAppButton("/studio")).toBe(true);
    expect(showWhatsAppButton("/my-care")).toBe(true);
    expect(showWhatsAppButton("/doctor/register")).toBe(true);
    expect(showWhatsAppButton("/doctor/profile")).toBe(true);
    expect(showWhatsAppButton("/visit/abc")).toBe(false);
    expect(showWhatsAppButton("/visit")).toBe(false);
    expect(showWhatsAppButton("/doctor/dashboard")).toBe(false);
    expect(showWhatsAppButton("/admin")).toBe(false);
    expect(showWhatsAppButton("/admin/payments")).toBe(false);
  });
});
