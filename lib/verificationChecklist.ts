export const VERIFICATION_CHECKLIST_ITEMS = [
  { key: "pmdc_number_verified", label: "PMDC number verified at pmdc.org.pk" },
  { key: "name_matches", label: "Name on PMDC record matches the name submitted" },
  { key: "registration_active", label: "Registration status is Active (not suspended/expired)" },
  { key: "pmdc_certificate_legible", label: "PMDC certificate document is legible and matches the number" },
  { key: "degree_certificate_legible", label: "Degree certificate is legible" },
  { key: "cnic_matches", label: "CNIC matches the name" },
  { key: "specialization_consistent", label: "Specialization is consistent with qualifications" },
] as const;
