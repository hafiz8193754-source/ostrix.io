import { describe, expect, it } from "vitest";

import { COUNTRIES } from "@/lib/countryData";
import {
  canonicalCountryName,
  cnicError,
  filterCountries,
  licenseError,
  normalizeCountry,
  storedPhone,
} from "@/lib/countries";
import { doctorRegisterSchema } from "@/lib/schemas";

describe("ISO country list", () => {
  it("lists every assigned ISO 3166-1 country once, in English alphabetical order", () => {
    expect(COUNTRIES).toHaveLength(249);
    expect(new Set(COUNTRIES.map((country) => country.code)).size).toBe(249);
    const folded = COUNTRIES.map((country) =>
      country.name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    );
    expect([...folded].sort((a, b) => a.localeCompare(b))).toEqual(folded);
    expect(COUNTRIES.some((country) => country.name === "Pakistan")).toBe(true);
    expect(COUNTRIES.some((country) => country.name === "United Kingdom")).toBe(true);
    expect(COUNTRIES.some((country) => country.name === "Zimbabwe")).toBe(true);
  });

  it("maps saved names and ISO codes onto the same country, and keeps an unknown saved value", () => {
    expect(normalizeCountry("PK")?.name).toBe("Pakistan");
    expect(normalizeCountry("pak")?.name).toBe("Pakistan");
    expect(normalizeCountry("pakistan")?.name).toBe("Pakistan");
    expect(normalizeCountry("GB")?.name).toBe("United Kingdom");
    expect(normalizeCountry("UK")?.name).toBe("United Kingdom");
    expect(normalizeCountry("United Kingdom of Great Britain and Northern Ireland")?.name).toBe("United Kingdom");
    expect(normalizeCountry("USA")?.name).toBe("United States");
    expect(normalizeCountry("UAE")?.name).toBe("United Arab Emirates");
    expect(normalizeCountry("South Korea")?.name).toBe("South Korea");
    expect(normalizeCountry("Lahore")).toBeNull();
    expect(canonicalCountryName("pk")).toBe("Pakistan");
    expect(canonicalCountryName("A saved place we do not recognise")).toBe("A saved place we do not recognise");
  });

  it("filters by typing a name, code, or calling code", () => {
    expect(filterCountries("")).toHaveLength(249);
    expect(filterCountries("united").map((country) => country.name)).toEqual(
      expect.arrayContaining(["United Kingdom", "United States", "United Arab Emirates"])
    );
    expect(filterCountries("jp").map((country) => country.code)).toContain("JP");
    expect(filterCountries("+92").map((country) => country.code)).toEqual(["PK"]);
  });
});

describe("country-specific phone and license", () => {
  it("keeps Pakistani mobiles and accepts a number for every other country", () => {
    expect(storedPhone("Pakistan", "0300-1234567")).toBe("+923001234567");
    expect(storedPhone("PK", "+92 300 1234567")).toBe("+923001234567");
    expect(storedPhone("United Kingdom", "07123 456789")).toBe("+447123456789");
    expect(storedPhone("GB", "+44 7123 456789")).toBe("+447123456789");
    expect(storedPhone("Japan", "09012345678")).toBe("+819012345678");
    expect(storedPhone("Pakistan", "07123")).toBeNull();
  });

  it("requires a PMDC number only in Pakistan", () => {
    expect(licenseError("Pakistan", "12345-P")).toBeNull();
    expect(licenseError("PK", "ABC-99")).toMatch(/PMDC/);
    expect(licenseError("United Kingdom", "GMC-1234567")).toBeNull();
    expect(cnicError("Pakistan", "12345-1234567-1")).toBeNull();
    expect(cnicError("Pakistan", "")).toMatch(/CNIC/);
    expect(cnicError("Kenya", "")).toBeNull();
  });

  it("accepts a non-Pakistani registration that would have failed the old PMDC and phone rules", () => {
    const parsed = doctorRegisterSchema.safeParse({
      full_name: "Amelia Khan",
      cnic: "",
      email: "amelia@example.com",
      phone: "07123456789",
      whatsapp: "",
      country: "UK",
      pmdc_number: "GMC7654321",
      pmdc_registration_type: "full",
      pmdc_expiry_date: "2030-01-01",
      specialization: "general_physician",
      sub_specialization: "",
      qualifications: "MBBS",
      year_of_graduation: 2012,
      experience_years: 8,
      languages: ["English"],
      clinic_name: "High Street Clinic",
      clinic_address: "1 High Street",
      city: "London",
      accepts_online: true,
      accepts_walk_in: false,
      consultation_fee_pkr: 0,
      max_daily_appointments: 10,
      bio: "",
      pmdc_certificate_url: "docs/license.pdf",
      degree_certificate_url: "docs/degree.pdf",
      cnic_front_url: "",
      profile_photo_url: "",
      schedule: [{ day_of_week: 1, start_time: "09:00", end_time: "17:00", consultation_type: "online", slot_duration_minutes: 20 }],
      declaration_pmdc_valid: true,
      declaration_ai_responsibility: true,
      declaration_terms: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.country).toBe("UK");
  });
});
