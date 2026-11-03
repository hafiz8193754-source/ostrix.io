import { describe, expect, it } from "vitest";
import { doctorInitials, doctorName } from "./doctorDisplay";
describe("doctor display", () => {
  it("avoids double Dr prefix", () => {
    expect(doctorName("Dr.Ahmad Raza")).toBe("Dr. Ahmad Raza");
    expect(doctorName("Dr. Dr. Ahmad Raza")).toBe("Dr. Ahmad Raza");
    expect(doctorName("Drew Khan")).toBe("Dr. Drew Khan");
  });
  it("initials ignore honorifics and symbols", () => {
    expect(doctorInitials("Dr. Test (Ostrix QA)")).toBe("TO");
    expect(doctorInitials("Dr.Ahmad Raza")).toBe("AR");
    expect(doctorInitials("")).toBe("");
  });
});
