export const SPECIALIZATIONS = [
  ["general_physician", "General Physician"],
  ["cardiologist", "Cardiologist"],
  ["dermatologist", "Dermatologist"],
  ["orthopedic", "Orthopedic Surgeon"],
  ["gynecologist", "Gynecologist"],
  ["pediatrician", "Pediatrician"],
  ["ent", "ENT Specialist"],
  ["dentist", "Dentist"],
  ["ophthalmologist", "Eye Specialist"],
  ["neurologist", "Neurologist"],
  ["psychiatrist", "Psychiatrist"],
  ["urologist", "Urologist"],
  ["pulmonologist", "Pulmonologist"],
  ["gastroenterologist", "Gastroenterologist"],
  ["endocrinologist", "Endocrinologist"],
  ["oncologist", "Oncologist"],
  ["nephrologist", "Nephrologist"],
  ["rheumatologist", "Rheumatologist"],
] as const;

export const LANGUAGES = ["English", "Urdu", "Punjabi", "Pashto", "Sindhi", "Balochi", "Saraiki"];

export const CITIES = [
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Other",
];

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60];

export interface ScheduleRow {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
  consultation_type: "online" | "walk_in" | "both";
  slot_duration_minutes: number;
}

export function defaultSchedule(): ScheduleRow[] {
  return DAY_LABELS.map((_, i) => ({
    day_of_week: i,
    enabled: false,
    start_time: "09:00",
    end_time: "17:00",
    consultation_type: "both",
    slot_duration_minutes: 20,
  }));
}

export interface RegistrationAnswers {
  // Step 1 — Account & Identity
  full_name: string;
  cnic: string;
  email: string;
  phone: string;
  whatsapp: string;
  whatsappSame: boolean;

  // Step 2 — Professional Credentials
  pmdc_number: string;
  pmdc_registration_type: "provisional" | "full" | "specialist" | "";
  pmdc_expiry_date: string;
  specialization: string;
  sub_specialization: string;
  qualifications: string;
  year_of_graduation: string;
  experience_years: string;
  languages: string[];

  // Step 3 — Practice Details
  clinic_name: string;
  clinic_address: string;
  city: string;
  cityOther: string;
  accepts_online: boolean;
  accepts_walk_in: boolean;
  consultation_fee_pkr: string;
  max_daily_appointments: string;
  bio: string;

  // Step 4 — Documents
  pmdc_certificate_url: string;
  degree_certificate_url: string;
  cnic_front_url: string;
  profile_photo_url: string;

  // Step 5 — Weekly Schedule
  schedule: ScheduleRow[];

  // Step 6 — Declarations
  declaration_pmdc_valid: boolean;
  declaration_ai_responsibility: boolean;
  declaration_terms: boolean;
}

export function initialAnswers(): RegistrationAnswers {
  return {
    full_name: "",
    cnic: "",
    email: "",
    phone: "",
    whatsapp: "",
    whatsappSame: true,
    pmdc_number: "",
    pmdc_registration_type: "",
    pmdc_expiry_date: "",
    specialization: SPECIALIZATIONS[0][0],
    sub_specialization: "",
    qualifications: "",
    year_of_graduation: "",
    experience_years: "",
    languages: ["English", "Urdu"],
    clinic_name: "",
    clinic_address: "",
    city: CITIES[0],
    cityOther: "",
    accepts_online: true,
    accepts_walk_in: true,
    consultation_fee_pkr: "",
    max_daily_appointments: "20",
    bio: "",
    pmdc_certificate_url: "",
    degree_certificate_url: "",
    cnic_front_url: "",
    profile_photo_url: "",
    schedule: defaultSchedule(),
    declaration_pmdc_valid: false,
    declaration_ai_responsibility: false,
    declaration_terms: false,
  };
}

// Shared Tailwind classes so every step's inputs look identical — copied
// from the pre-wizard single-step register form's exact styling.
export const fieldClass = "flex flex-col gap-1 text-sm";
export const inputClass =
  "h-10 rounded-lg border border-border bg-bg-elevated px-3 text-text-primary outline-none focus-visible:border-accent";

export interface StepProps {
  values: RegistrationAnswers;
  onChange: (patch: Partial<RegistrationAnswers>) => void;
  onNext: () => void;
  onBack: () => void;
}
