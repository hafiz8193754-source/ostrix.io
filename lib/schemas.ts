import { z } from "zod";

// ---------- Doctor & Clinical Agent ----------

export const symptomAnalysisSchema = z.object({
  symptoms: z.string().trim().min(1, "Describe what's going on.").max(2000, "Keep it under 2000 characters."),
  patientAge: z.coerce.number().int().positive().optional(),
  // Set instead of patientAge when the patient is an infant described in
  // months rather than years — under-3-months is an automatic emergency
  // regardless of which symptom keyword (if any) matched.
  patientAgeMonths: z.coerce.number().int().nonnegative().optional(),
  patientGender: z.enum(["male", "female", "other"]).optional(),
  city: z.string().trim().max(80).optional(),
});
export type SymptomAnalysisInput = z.infer<typeof symptomAnalysisSchema>;

export const appointmentBookingSchema = z.object({
  doctor_id: z.string().uuid(),
  date: z.string().trim().min(1, "Pick a date."),
  time: z.string().trim().min(1, "Pick a time."),
  type: z.enum(["online", "walk_in"]),
  symptoms_description: z.string().trim().max(2000).optional().or(z.literal("")),
  ai_analysis: z.record(z.string(), z.any()).optional(),
  // Links the booking back to the Doctor-mode chat session it came from, so
  // an approved prescription can later be delivered as a message in that
  // same conversation.
  session_id: z.string().uuid().optional(),
  patient: z.object({
    full_name: z.string().trim().min(1, "Name is required."),
    age: z.coerce.number().int().positive().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    phone: z.string().trim().min(1, "Phone is required."),
    known_allergies: z.array(z.string()).optional(),
    current_medications: z.array(z.string()).optional(),
  }),
});
export type AppointmentBookingInput = z.infer<typeof appointmentBookingSchema>;

export const appointmentUpdateSchema = z.object({
  appointment_id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]),
});
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;

export const callStartSchema = z.object({ appointment_id: z.string().uuid() });

export const callConsentSchema = z.object({
  consultation_id: z.string().uuid(),
  party: z.enum(["patient", "doctor"]),
  consents: z.boolean(),
});

export const callEndSchema = z.object({
  consultation_id: z.string().uuid(),
  duration_seconds: z.coerce.number().int().nonnegative(),
  doctor_notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const prescriptionDraftSchema = z.object({
  consultation_id: z.string().uuid(),
});

const prescriptionDataSchema = z.object({
  diagnosis: z.string(),
  medications: z.array(
    z.object({
      name: z.string(),
      dosage: z.string(),
      frequency: z.string(),
      duration: z.string(),
      route: z.string(),
      instructions: z.string(),
      quantity: z.coerce.number(),
      warnings: z.array(z.string()).default([]),
    })
  ),
  lab_tests: z.array(z.object({ name: z.string(), reason: z.string() })).default([]),
  advice: z.array(z.string()).default([]),
  follow_up: z.string().default(""),
  emergency_instructions: z.string().default(""),
  drug_interaction_warnings: z.array(z.string()).default([]),
  contraindication_flags: z.array(z.string()).default([]),
});

export const prescriptionReviewSchema = z.object({
  prescription_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "edit"]),
  edited_prescription: prescriptionDataSchema.optional(),
  rejection_reason: z.string().trim().max(1000).optional(),
  signature_data: z.string().optional(),
});
export type PrescriptionReviewInput = z.infer<typeof prescriptionReviewSchema>;

// One row of the wizard's weekly-schedule step; becomes a doctor_schedules row.
export const scheduleRowSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().trim().min(1, "Start time is required."),
  end_time: z.string().trim().min(1, "End time is required."),
  consultation_type: z.enum(["online", "walk_in", "both"]).default("both"),
  slot_duration_minutes: z.coerce.number().int().positive().default(20),
});
export type ScheduleRowInput = z.infer<typeof scheduleRowSchema>;

// Full 6-step registration wizard payload. pmdc_verified/registration_status/
// verified_at/verified_by/is_active are deliberately NOT fields on this schema
// — a doctor can never set them through this route no matter what the client
// sends, since zod strips unknown keys by default and the route additionally
// deletes them from the raw body before parsing (belt and suspenders).
export const doctorRegisterSchema = z.object({
  // Step 1 — Account & Identity
  full_name: z.string().trim().min(3, "Enter the name as printed on your PMDC certificate."),
  cnic: z.string().trim().regex(/^\d{5}-\d{7}-\d{1}$/, "CNIC should look like 12345-1234567-1."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().regex(/^(03\d{2}-?\d{7}|\+92\s?3\d{2}\s?\d{7})$/, "Enter a valid Pakistani mobile number."),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),

  // Step 2 — Professional Credentials
  pmdc_number: z.string().trim().regex(/^\d{5,7}(-[A-Za-z])?$/, "PMDC number should look like 12345-P or 123456."),
  pmdc_registration_type: z.enum(["provisional", "full", "specialist"]),
  pmdc_expiry_date: z.string().trim().min(1, "Pick the PMDC expiry date."),
  specialization: z.string().trim().min(1, "Pick a specialization."),
  sub_specialization: z.string().trim().max(120).optional().or(z.literal("")),
  qualifications: z.string().trim().min(1, "Qualifications are required."),
  year_of_graduation: z.coerce.number().int().min(1960, "Enter a valid graduation year."),
  experience_years: z.coerce.number().int().min(0).max(60),
  languages: z.array(z.string()).min(1).default(["English", "Urdu"]),

  // Step 3 — Practice Details
  clinic_name: z.string().trim().min(1, "Clinic/hospital name is required."),
  clinic_address: z.string().trim().min(1, "Address is required."),
  city: z.string().trim().min(1, "City is required."),
  accepts_online: z.boolean().default(true),
  accepts_walk_in: z.boolean().default(true),
  consultation_fee_pkr: z.coerce.number().int().min(0).max(100000),
  max_daily_appointments: z.coerce.number().int().positive().default(20),
  bio: z.string().trim().max(500).optional().or(z.literal("")),

  // Step 4 — Documents. Files are uploaded to Supabase Storage client-side
  // first (see components/doctor/registration/StepDocuments.tsx) — only the
  // resulting object paths travel through this API.
  pmdc_certificate_url: z.string().trim().min(1, "Upload your PMDC certificate."),
  degree_certificate_url: z.string().trim().min(1, "Upload your degree certificate."),
  cnic_front_url: z.string().trim().min(1, "Upload your CNIC."),
  profile_photo_url: z.string().trim().optional().or(z.literal("")),

  // Step 5 — Weekly Schedule
  schedule: z.array(scheduleRowSchema).min(1, "Add at least one available day."),

  // Step 6 — Declarations
  declaration_pmdc_valid: z.literal(true, { errorMap: () => ({ message: "This declaration is required." }) }),
  declaration_ai_responsibility: z.literal(true, { errorMap: () => ({ message: "This declaration is required." }) }),
  declaration_terms: z.literal(true, { errorMap: () => ({ message: "This declaration is required." }) }),
});
export type DoctorRegisterInput = z.infer<typeof doctorRegisterSchema>;

export const heartbeatSchema = z.object({
  status: z.enum(["available", "busy", "on_break", "do_not_disturb"]).optional(),
  reset_override: z.boolean().optional(),
});
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;

// navigator.sendBeacon can't set an Authorization header, so this is the one
// route in the app that reads the access token from the body instead.
export const presenceOfflineSchema = z.object({
  access_token: z.string().trim().min(1),
});
export type PresenceOfflineInput = z.infer<typeof presenceOfflineSchema>;

export const scheduleUpdateSchema = z.object({
  schedule: z.array(scheduleRowSchema),
});
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;

export const availabilityExceptionSchema = z.object({
  exception_date: z.string().trim().min(1, "Pick a date."),
  is_available: z.boolean(),
  start_time: z.string().trim().optional().or(z.literal("")),
  end_time: z.string().trim().optional().or(z.literal("")),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});
export type AvailabilityExceptionInput = z.infer<typeof availabilityExceptionSchema>;

// Admin review actions on a doctor's registration. "approve" carries the
// ticked checklist item keys — the route independently verifies every
// required key from lib/clinical.ts's VERIFICATION_CHECKLIST_ITEMS is present
// rather than trusting the array length alone.
export const adminVerifyActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), checklist: z.array(z.string()).min(1, "Complete the checklist first.") }),
  z.object({ action: z.literal("request_info"), note: z.string().trim().min(1, "Describe what's needed.") }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(1, "A rejection reason is required.") }),
  z.object({ action: z.literal("suspend"), reason: z.string().trim().min(1, "A suspension reason is required.") }),
]);
export type AdminVerifyActionInput = z.infer<typeof adminVerifyActionSchema>;

export const notifyMeSchema = z.object({
  doctor_id: z.string().uuid(),
});
export type NotifyMeInput = z.infer<typeof notifyMeSchema>;

export const notificationMarkReadSchema = z.object({
  all: z.boolean().optional(),
});
export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;

// ---------- Profile / settings ----------

export const profileSettingsSchema = z.object({
  display_name: z.string().trim().max(80).optional(),
  avatar_url: z.string().trim().optional(),
  settings: z
    .object({
      theme: z.enum(["dark", "light", "system"]).optional(),
      language: z.enum(["en", "ur", "pa"]).optional(),
      defaultAgent: z.enum(["doctor"]).optional(),
      autoTitles: z.boolean().optional(),
      apiKeys: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});
export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type "DELETE" to confirm.' }) }),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const sessionCreateSchema = z.object({
  agent: z.enum(["doctor"]),
  title: z.string().trim().min(1).max(120).optional(),
});
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;

export const sessionRenameSchema = z.object({
  title: z.string().trim().min(1, "Title can't be empty.").max(120, "Keep the title under 120 characters."),
});
export type SessionRenameInput = z.infer<typeof sessionRenameSchema>;

export const deleteDataSchema = z.object({
  confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type "DELETE" to confirm.' }) }),
});
export type DeleteDataInput = z.infer<typeof deleteDataSchema>;

export const waitlistSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});
export type WaitlistInput = z.infer<typeof waitlistSchema>;

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Display name can't be empty.").max(80, "Keep it under 80 characters."),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const generalSettingsSchema = z.object({
  language: z.enum(["en", "ur"]),
  email_notifications: z.boolean(),
});
export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

export const privacySettingsSchema = z.object({
  save_history: z.boolean(),
});
export type PrivacySettingsInput = z.infer<typeof privacySettingsSchema>;

export const authSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});
export type AuthInput = z.infer<typeof authSchema>;

// Loose on `content` deliberately — it stores an arbitrary ChatMessage shape
// (union of user/agent/site/plan/form variants) as JSONB, validated at the
// TypeScript layer by the caller rather than mirrored fully here.
export const messageAppendSchema = z.object({
  role: z.enum(["user", "agent", "form"]),
  content: z.record(z.string(), z.any()),
});
export type MessageAppendInput = z.infer<typeof messageAppendSchema>;

// ---------- Payments (Bank Transfer only) ----------

const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const bankDetailsSchema = z.object({
  bank_name: optText(100),
  bank_account_title: optText(100),
  bank_account_number: optText(50),
  bank_iban: optText(34),
  bank_instructions: optText(1000),
});

export const paymentSubmitSchema = z.object({
  appointment_id: z.string().uuid(),
  transfer_reference: z.string().trim().min(3, "Enter the transaction / reference number.").max(100),
  receipt_path: z.string().trim().max(300).optional().nullable(),
});

export const paymentReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});
