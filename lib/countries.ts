import { COUNTRIES, type Country } from "@/lib/countryData";

export type { Country };
export { COUNTRIES };

const PMDC_RE = /^\d{5,7}(-[A-Za-z])?$/;
const CNIC_RE = /^\d{5}-\d{7}-\d{1}$/;
const LICENSE_RE = /^[A-Za-z0-9][A-Za-z0-9./-]{2,39}$/;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘]/g, "'")
    .trim()
    .toLowerCase();
}

const byCode = new Map(COUNTRIES.map((country) => [country.code, country]));
const byAlpha3 = new Map(COUNTRIES.map((country) => [country.alpha3, country]));
const byName = new Map<string, Country>();
for (const country of COUNTRIES) {
  for (const label of [country.name, country.code, country.alpha3, ...country.aliases]) {
    byName.set(fold(label), country);
  }
}

/** Resolve a stored English name, alias, or ISO alpha-2/alpha-3 code. */
export function normalizeCountry(value: string | null | undefined): Country | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const byIso = byCode.get(trimmed.toUpperCase());
    if (byIso) return byIso;
  }
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    const byIso3 = byAlpha3.get(trimmed.toUpperCase());
    if (byIso3) return byIso3;
  }
  return byName.get(fold(trimmed)) ?? null;
}

/** Canonical English name. Unknown text is kept so a saved value is not wiped. */
export function canonicalCountryName(value: string | null | undefined, fallback = "Pakistan"): string {
  const found = normalizeCountry(value);
  if (found) return found.name;
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function isPakistan(value: string | null | undefined): boolean {
  return normalizeCountry(value)?.code === "PK";
}

/** Type-to-filter. Empty query returns the full alphabetical list. */
export function filterCountries(query: string): Country[] {
  const q = fold(query);
  if (!q) return [...COUNTRIES];
  const qDigits = q.replace(/^\+/, "");
  return COUNTRIES.filter((country) => {
    if (fold(country.name).includes(q)) return true;
    if (country.code.toLowerCase() === q || country.alpha3.toLowerCase() === q) return true;
    if (country.aliases.some((alias) => fold(alias).includes(q))) return true;
    if (qDigits && country.dials.some((dial) => dial.startsWith(qDigits))) return true;
    return false;
  });
}

export function countryDialLabel(value: string | null | undefined): string {
  const country = normalizeCountry(value);
  if (!country) return "";
  return `+${country.dials[0]}`;
}

/**
 * Store a phone as E.164. Pakistani local numbers (03xx…) stay valid.
 * Any other country accepts a national number or a number that already
 * starts with that country's calling code.
 */
export function storedPhone(countryValue: string, raw: string): string | null {
  const country = normalizeCountry(countryValue);
  if (!country) return null;
  const compact = raw.replace(/[\s\-().]/g, "");
  if (!compact) return null;

  if (country.code === "PK") {
    let digits = "";
    if (compact.startsWith("+")) digits = compact.slice(1).replace(/\D/g, "");
    else if (compact.startsWith("00")) digits = compact.slice(2).replace(/\D/g, "");
    else if (/^03\d{9}$/.test(compact)) digits = `92${compact.slice(1)}`;
    else if (/^3\d{9}$/.test(compact)) digits = `92${compact}`;
    else if (/^92\d{10}$/.test(compact.replace(/\D/g, ""))) digits = compact.replace(/\D/g, "");
    else return null;
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  }

  let digits = "";
  if (compact.startsWith("+")) digits = compact.slice(1).replace(/\D/g, "");
  else if (compact.startsWith("00")) digits = compact.slice(2).replace(/\D/g, "");
  else digits = compact.replace(/\D/g, "");
  if (!digits) return null;

  const dials = [...country.dials].sort((a, b) => b.length - a.length);
  const matched = dials.find((dial) => digits.startsWith(dial));
  if (matched) {
    if (digits.length < matched.length + 4 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const national = digits.replace(/^0+/, "");
  const full = `${dials[0]}${national}`;
  if (national.length < 4 || national.length > 14 || full.length < 8 || full.length > 15) return null;
  return `+${full}`;
}

export function phoneError(countryValue: string, raw: string): string | null {
  if (!normalizeCountry(countryValue)) return "Choose a country first.";
  if (!raw.trim()) return "Enter a phone number.";
  if (storedPhone(countryValue, raw)) return null;
  if (isPakistan(countryValue)) return "Enter a valid Pakistani mobile number.";
  const dial = countryDialLabel(countryValue);
  return `Enter a phone number for this country${dial ? ` (${dial})` : ""}.`;
}

/** Pakistan keeps the PMDC format. Every other country accepts its own license number. */
export function licenseError(countryValue: string, raw: string): string | null {
  if (!normalizeCountry(countryValue)) return "Choose a country first.";
  const value = raw.trim();
  if (isPakistan(countryValue)) {
    return PMDC_RE.test(value) ? null : "PMDC number should look like 12345-P or 123456.";
  }
  return LICENSE_RE.test(value) ? null : "Enter the license number from your medical registration (3–40 letters or numbers).";
}

export function cnicError(countryValue: string, raw: string): string | null {
  const value = raw.trim();
  if (!isPakistan(countryValue)) {
    if (!value) return null;
    return value.length <= 40 ? null : "National ID is too long.";
  }
  return CNIC_RE.test(value) ? null : "CNIC should look like 12345-1234567-1.";
}
