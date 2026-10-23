import { describe, expect, it } from "vitest";
import { destinationFor, inferRole, isAccountRole } from "./accountRole";

const base = { stored: null, isAdmin: false, hasDoctorProfile: false, hasPatientRecord: false };

describe("inferRole", () => {
  it("new account has no role", () => expect(inferRole(base)).toBeNull());
  it("admin comes only from platform_admins", () => expect(inferRole({ ...base, isAdmin: true, stored: "doctor" })).toBe("admin"));
  it("stored choice wins", () => expect(inferRole({ ...base, stored: "patient", hasDoctorProfile: true })).toBe("patient"));
  it("existing doctor inferred", () => expect(inferRole({ ...base, hasDoctorProfile: true, hasPatientRecord: true })).toBe("doctor"));
  it("existing patient inferred", () => expect(inferRole({ ...base, hasPatientRecord: true })).toBe("patient"));
  it("ignores bogus stored values", () => expect(inferRole({ ...base, stored: "admin" })).toBeNull());
});

describe("destinationFor", () => {
  it("routes each role", () => {
    expect(destinationFor("patient", false)).toBe("/my-care");
    expect(destinationFor("doctor", false)).toBe("/doctor/register");
    expect(destinationFor("doctor", true)).toBe("/doctor/dashboard");
    expect(destinationFor("admin", false)).toBe("/admin");
    expect(destinationFor(null, false)).toBe("/welcome");
  });
  it("admin is not a choosable role", () => expect(isAccountRole("admin")).toBe(false));
});
