import { describe, expect, it } from "vitest";
import { ROUTING_SYSTEM, oneLine, resolveRoute, routeByKeywords } from "./routing";
import { triageSafetyNet } from "./triage";

describe("instant routing (no follow-up questions)", () => {
  it.each([
    ["pait mein dard", "gastroenterologist"],
    ["skin rash", "dermatologist"],
    ["bukhar aur khansi", "general_physician"],
    ["mere daant mein dard hai", "dentist"],
    ["kaan mein dard", "ent"],
    ["mera bacha bimar hai", "pediatrician"],
    ["asdf feel weird", "general_physician"],
  ])("%s -> %s", (text, key) => {
    const r = routeByKeywords(text);
    expect(r.specialization).toBe(key);
    expect(r.reason).not.toMatch(/\?/);
  });

  it("uses the model's specialty when valid, else keywords, else GP", () => {
    expect(resolveRoute("pait dard", { specialization: "dermatologist", reason: "Skin doc. Extra." }).reason).toBe("Skin doc.");
    expect(resolveRoute("pait mein dard", { specialization: "wizard" }).specialization).toBe("gastroenterologist");
    expect(resolveRoute("something odd", null).specialization).toBe("general_physician");
  });

  it("reason is always a single line with no question", () => {
    const r = resolveRoute("x", { specialization: "general_physician", reason: "How long have you had it? GP first." });
    expect(r.reason).not.toContain("\n");
    expect(oneLine("a\nb")).toBe("a b");
  });

  it("system prompt forbids follow-up questions", () => {
    expect(ROUTING_SYSTEM).toMatch(/NEVER ask the patient any question/);
    expect(ROUTING_SYSTEM).not.toMatch(/questions_for_doctor/);
  });

  it("emergency red flags still detected", () => {
    expect(triageSafetyNet("seene mein dard ho raha hai")).toBeTruthy();
    expect(triageSafetyNet("chest pain and sweating")).toBeTruthy();
    expect(triageSafetyNet("pait mein dard")).toBeNull();
  });
});
