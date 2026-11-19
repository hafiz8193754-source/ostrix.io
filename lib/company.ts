// Contact details shown in the footer, on /about, and on the legal pages.
// An empty field is hidden, so the company number stays off the page until
// there is a real registration number to show.
export const isPlaceholder = false;

export const COMPANY = {
  companyName: "Ostrix",
  registeredAddress: "United Kingdom",
  companyNumber: "",
  email: "hafiz8193754@gmail.com",
  phone: "+447878268504",
  whatsapp: "+447878268504",
};

export const WHATSAPP_GREETING = "Hi Ostrix, I need help booking a doctor";

export function whatsappLink(text = WHATSAPP_GREETING): string {
  const digits = COMPANY.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const HIDDEN_WHATSAPP = ["/visit", "/doctor/dashboard", "/admin"];

export function showWhatsAppButton(pathname: string): boolean {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return !HIDDEN_WHATSAPP.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export type CompanyField = { label: string; value: string; href?: string };

export function companyFields(): CompanyField[] {
  const c = COMPANY;
  const f: CompanyField[] = [
    { label: "Company", value: c.companyName.trim() },
    { label: "Address", value: c.registeredAddress.trim() },
    { label: "Company number", value: c.companyNumber.trim() },
    { label: "Email", value: c.email.trim(), href: c.email.trim() ? `mailto:${c.email.trim()}` : undefined },
    { label: "Phone", value: c.phone.trim(), href: c.phone.trim() ? `tel:${c.phone.replace(/[^\d+]/g, "")}` : undefined },
  ];
  return f.filter((x) => x.value);
}

export const LICENSING_NOTE =
  "Doctors on Ostrix are PMDC-registered and licensed in Pakistan. If you are outside Pakistan, please check your local rules on online consultations and prescriptions.";
