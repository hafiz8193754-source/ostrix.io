import { COMPANY } from "@/lib/company";

export function LegalContact() {
  return (
    <p>
      {COMPANY.companyName}, {COMPANY.registeredAddress}. Email{" "}
      <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. Phone{" "}
      <a href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a>.
    </p>
  );
}
