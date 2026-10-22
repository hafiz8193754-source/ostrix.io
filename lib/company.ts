// Company details shown in the footer and on /about.
// Fill these in with the real, registered details. Empty fields are hidden
// everywhere, so nothing placeholder or invented is ever shown to visitors.
// PLACEHOLDER - replace before production
export const isPlaceholder = true;

export const COMPANY = {
  companyName: "Ostrix Health Ltd",
  registeredAddress: "123 Example Street, London, EC1A 1AA, United Kingdom", // UK registered office address
  companyNumber: "00000000", // Companies House number
  email: "hello@example.com",
  phone: "+44 20 0000 0000",
};

export type CompanyField = { label: string; value: string; href?: string };

export function companyFields(): CompanyField[] {
  const c = COMPANY;
  const f: CompanyField[] = [
    { label: "Company", value: c.companyName.trim() },
    { label: "Registered office (UK)", value: c.registeredAddress.trim() },
    { label: "Company number", value: c.companyNumber.trim() },
    { label: "Email", value: c.email.trim(), href: c.email.trim() ? `mailto:${c.email.trim()}` : undefined },
    { label: "Phone", value: c.phone.trim(), href: c.phone.trim() ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : undefined },
  ];
  return f.filter((x) => x.value);
}

export const LICENSING_NOTE =
  "Doctors on Ostrix are PMDC-registered and licensed in Pakistan. If you are outside Pakistan, please check your local rules on online consultations and prescriptions.";
