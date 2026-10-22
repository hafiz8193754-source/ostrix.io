export type AgentMode = "doctor";

// A file queued client-side (Prompt Engineer's attach bar) before it's sent
// with the next chat message — data is base64, no "data:" prefix.
export interface PendingFileAttachment {
  kind: "image" | "pdf";
  mediaType: string;
  data: string;
  name: string;
  preview?: string;
}

export interface ProfileSettings {
  theme?: "dark" | "light" | "system";
  language?: "en" | "ur" | "pa";
  defaultAgent?: AgentMode;
  autoTitles?: boolean;
  apiKeys?: Record<string, string>;
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  settings: ProfileSettings;
}

export interface Artifact {
  id: string;
  message_id: string;
  type: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SiteFile {
  path: string;
  content: string;
}

export interface Site {
  name: string;
  summary: string;
  files: SiteFile[];
}

export interface DeployResult {
  repo: string | null;
  url: string | null;
}

export interface FarmCostLine {
  item: string;
  per_acre_pkr: string;
  total_pkr: string;
}

export interface FarmMonthPlan {
  label: string;
  details: string;
}

export interface FarmDiagnosis {
  likely_issue: string;
  confidence: string;
  treatment: string;
  advice: string;
}

export interface FarmCostProjection {
  costs: FarmCostLine[];
  total_investment_pkr: string;
  expected_yield_maunds_per_acre: string;
  market_rate_pkr_per_maund: string;
  market_rate_source: string;
  market_rate_date: string;
  gross_revenue_pkr: string;
  net_profit_pkr: string;
  profit_per_acre_pkr: string;
  price_caveat: string;
}

export interface FarmPlan {
  crop_recommendation: { crop: string; variety: string; reasoning: string; sowing_window: string };
  diagnosis: FarmDiagnosis | null;
  season_plan: FarmMonthPlan[];
  cost_projection: FarmCostProjection;
  honesty_note: string;
}

export interface FarmMeta {
  district: string;
  land: string;
}

export interface PhotoPayload {
  data: string;
  type: string;
}

// Result of the Phase 7 screenshot-analysis pass (app/api/builder/screenshot).
export interface ScreenshotAnalysis {
  business_type: string;
  layout: string;
  color_palette: string[];
  typography: string;
  sections: string[];
  navigation_style: string;
  hero_style: string;
  interactions: string[];
  overall_aesthetic: string;
  improvements_needed: string[];
}

// Discriminated union covering every bubble/card that can appear in a thread —
// role narrows which optional fields are meaningful.
export type ChatMessage =
  | {
      role: "user";
      text: string;
      photo?: string;
      attachments?: { kind: "image" | "pdf"; name: string; preview?: string }[];
      sourceUrl?: string;
    }
  | { role: "agent"; text: string }
  | {
      role: "agent";
      site: Site;
      deployed: "pending" | DeployResult | null;
      deployError?: string | null;
      refinedCount?: number;
      consoleError?: string | null;
      sandboxPreviewUrl?: string | null;
      sandboxLogs?: string[];
      source?: "screenshot";
      analysis?: ScreenshotAnalysis;
    }
  | { role: "agent"; plan: FarmPlan; meta: FarmMeta };

export interface Session {
  id: string;
  user_id: string;
  agent: AgentMode;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface UsageStats {
  builder: { used: number; limit: number };
  farm: { used: number; limit: number };
}

export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
}

// ---------- Real-time generation progress (hooks/useStepProgress.ts) ----------

export type StepState = "pending" | "active" | "completed" | "failed";

export interface ProgressStep {
  id: string;
  label: string;
  status: StepState;
  duration?: number; // seconds taken, set once status becomes "completed"
}

export interface GenerationStatus {
  isActive: boolean;
  steps: ProgressStep[];
  currentDetail: string;
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
  failed: boolean;
  errorMessage: string | null;
}

// ---------- Doctor & Clinical Agent ----------
// Decision-support only — the AI never diagnoses or prescribes directly.

import type { AvailabilityStatus, PresenceResult } from "@/lib/presence";

export type Urgency = "routine" | "soon" | "urgent" | "emergency";

// registration_status is the real gate on clinical access — pmdc_verified is
// kept in lockstep with it (true only when registration_status === "verified")
// but both are stored since the RLS policy and older code path check
// pmdc_verified directly.
export type RegistrationStatus = "pending" | "under_review" | "verified" | "rejected" | "suspended";
export type ManualStatusOverride = "available" | "busy" | "on_break" | "do_not_disturb";
export type PmdcRegistrationType = "provisional" | "full" | "specialist";

export interface Doctor {
  id: string;
  user_id: string | null;
  full_name: string;
  pmdc_number: string;
  pmdc_verified: boolean;
  specialization: string;
  sub_specialization: string | null;
  qualifications: string;
  experience_years: number;
  clinic_name: string | null;
  clinic_address: string | null;
  city: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  consultation_fee_pkr: number;
  available_days: string[];
  available_hours_start: string | null;
  available_hours_end: string | null;
  accepts_online: boolean;
  accepts_walk_in: boolean;
  bio: string | null;
  avatar_url: string | null;
  rating: number;
  total_consultations: number;
  is_active: boolean;

  // Registration / verification — never settable by the doctor, only by an
  // admin via /api/admin/doctors/[id]/verify.
  registration_status: RegistrationStatus;
  registration_note: string | null;
  rejection_reason: string | null;
  verified_at: string | null;
  verified_by: string | null;
  pmdc_registration_type: PmdcRegistrationType | null;
  pmdc_expiry_date: string | null;
  pmdc_expiry_warned_at: string | null;
  cnic: string | null;
  year_of_graduation: number | null;
  pmdc_certificate_url: string | null;
  degree_certificate_url: string | null;
  cnic_front_url: string | null;
  profile_photo_url: string | null;
  languages: string[];

  // Presence — automatic, operational, carries no legal/verification weight.
  is_online: boolean;
  availability_status: AvailabilityStatus;
  last_seen_at: string | null;
  manual_status_override: ManualStatusOverride | null;
  override_expires_at: string | null;
  accepting_new_patients: boolean;
  max_daily_appointments: number;
  signature_url: string | null;
}

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  day_of_week: number; // 0 = Sunday .. 6 = Saturday
  start_time: string;
  end_time: string;
  consultation_type: "online" | "walk_in" | "both";
  slot_duration_minutes: number;
  is_active: boolean;
}

export interface AvailabilityException {
  id: string;
  doctor_id: string;
  exception_date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface PlatformAdmin {
  user_id: string;
  role: "verifier" | "superadmin";
  created_at: string;
}

export interface DoctorVerificationLogEntry {
  id: string;
  doctor_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

// Client-safe (no server-only imports) — used by both lib/clinical.ts's
// searchDoctors() and any "use client" component that renders its results,
// e.g. components/doctor/DoctorDirectory.tsx.
export interface DoctorWithPresence extends Doctor {
  presence: PresenceResult;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Patient {
  id: string;
  user_id: string | null;
  full_name: string;
  age: number | null;
  gender: "male" | "female" | "other" | null;
  phone: string | null;
  blood_group: string | null;
  known_allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
}

export interface SymptomAnalysis {
  specialization: string;
  urgency: Urgency;
  reasoning: string;
  questions_for_doctor: string[];
  red_flags: string[];
  disclaimer: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  type: "online" | "walk_in";
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";
  symptoms_description: string | null;
  ai_suggested_specialization: string | null;
  ai_symptom_analysis: Record<string, unknown>;
  session_id: string | null;
  payment_status: PaymentStatus;
  fee_pkr: number;
  created_at: string;
}

export type PaymentStatus = "unpaid" | "pending" | "paid" | "rejected" | "not_required";

// Bank Transfer is the only payment method. Editable from /admin/payments.
export interface BankDetails {
  bank_name: string | null;
  bank_account_title: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_instructions: string | null;
}

export interface Payment {
  id: string;
  appointment_id: string;
  patient_id: string;
  payer_user_id: string | null;
  method: "bank_transfer";
  amount_pkr: number;
  transfer_reference: string;
  receipt_path: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Consultation {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  call_started_at: string | null;
  call_ended_at: string | null;
  call_duration_seconds: number | null;
  call_recording_url: string | null;
  twilio_call_sid: string | null;
  call_recording_consent_patient: boolean;
  call_recording_consent_doctor: boolean;
  ai_visit_summary: string | null;
  ai_transcript: string | null;
  doctor_notes: string | null;
  diagnosis: string | null;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  quantity: number;
  warnings: string[];
}

export interface PrescriptionData {
  diagnosis: string;
  medications: Medication[];
  lab_tests: { name: string; reason: string }[];
  advice: string[];
  follow_up: string;
  emergency_instructions: string;
  drug_interaction_warnings: string[];
  contraindication_flags: string[];
}

export type PrescriptionStatus = "draft" | "pending_review" | "approved" | "rejected" | "revised";

export interface Prescription {
  id: string;
  consultation_id: string;
  doctor_id: string;
  patient_id: string;
  status: PrescriptionStatus;
  ai_generated_prescription: PrescriptionData;
  doctor_edited_prescription: PrescriptionData | null;
  final_prescription: PrescriptionData | null;
  doctor_signature_hash: string | null;
  doctor_signed_at: string | null;
  doctor_pmdc_number: string;
  rejection_reason: string | null;
  pdf_url: string | null;
  warnings: string[];
  drug_interactions: string[];
  created_at: string;
}
