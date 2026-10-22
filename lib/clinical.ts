import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { computePresence, type PresenceResult } from "@/lib/presence";
import { createNotification } from "@/lib/notifications";
import { requireServiceClient } from "@/lib/serverAuth";

export { VERIFICATION_CHECKLIST_ITEMS } from "@/lib/verificationChecklist";
import type {
  Appointment,
  AvailabilityException,
  Consultation,
  Doctor,
  DoctorSchedule,
  DoctorWithPresence,
  Patient,
  Prescription,
  PrescriptionData,
  RegistrationStatus,
} from "@/types";
import type { AvailabilityExceptionInput, DoctorRegisterInput, ScheduleRowInput } from "@/lib/schemas";

// Presence sweeps and admin review touch other users' rows. They need the
// service role; callers that cannot proceed without it already return 503.
function serviceClient() {
  return requireServiceClient();
}

// ---------- Doctors ----------

export async function getDoctorByUserId(
  db: SupabaseClient,userId: string): Promise<Doctor | null> {
  const admin = db;
  const { data, error } = await admin.from("doctors").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return data as Doctor;
}

export async function getDoctorById(
  db: SupabaseClient,doctorId: string): Promise<Doctor | null> {
  const admin = db;
  const { data, error } = await admin.from("doctors").select("*").eq("id", doctorId).maybeSingle();
  if (error || !data) return null;
  return data as Doctor;
}

export interface DoctorSearchFilters {
  specialization?: string;
  city?: string;
  online_only?: boolean;
  available_now?: boolean;
}

// Replaces the old listMatchingDoctors — same verified/active gate, but now
// joins schedule+exceptions and computes live presence per doctor, applying
// the patient-facing sort order (available now > scheduled-available >
// offline-by-soonest-next-available > the rest, rating breaks ties).
export async function searchDoctors(
  db: SupabaseClient,filters: DoctorSearchFilters): Promise<DoctorWithPresence[]> {
  const admin = db;
  let query = admin
    .from("doctors")
    .select("*")
    .eq("is_active", true)
    .eq("pmdc_verified", true)
    .eq("registration_status", "verified");
  if (filters.specialization) query = query.eq("specialization", filters.specialization);
  if (filters.city) query = query.eq("city", filters.city);
  const { data, error } = await query.order("rating", { ascending: false }).limit(30);
  if (error || !data || !data.length) return [];

  const doctors = data as Doctor[];
  const ids = doctors.map((d) => d.id);
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: schedules }, { data: exceptions }] = await Promise.all([
    admin.from("doctor_schedules").select("*").in("doctor_id", ids).eq("is_active", true),
    admin.from("doctor_availability_exceptions").select("*").in("doctor_id", ids).gte("exception_date", today),
  ]);

  const now = new Date();
  let withPresence: DoctorWithPresence[] = doctors.map((doctor) => {
    const doctorSchedules = ((schedules || []) as DoctorSchedule[]).filter((s) => s.doctor_id === doctor.id);
    const doctorExceptions = ((exceptions || []) as AvailabilityException[]).filter((e) => e.doctor_id === doctor.id);
    return { ...doctor, presence: computePresence(doctor, doctorSchedules, doctorExceptions, now) };
  });

  if (filters.online_only) withPresence = withPresence.filter((d) => d.presence.status !== "offline");
  if (filters.available_now) withPresence = withPresence.filter((d) => d.presence.is_bookable);

  // Rank derived from the label rather than a dedicated flag: "Available now"
  // / "Online (outside clinic hours)" / an active "available" override are
  // heartbeat-backed (rank 0); "Clinic hours — book appointment" is
  // schedule-only (rank 1); offline-with-a-known-next-slot (rank 2); the rest (3).
  const rank = (d: DoctorWithPresence) => {
    if (d.presence.status === "available" && d.presence.label !== "Clinic hours — book appointment") return 0;
    if (d.presence.is_bookable) return 1;
    if (d.presence.next_available) return 2;
    return 3;
  };
  withPresence.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (rank(a) === 2) {
      const an = a.presence.next_available ? new Date(a.presence.next_available).getTime() : Infinity;
      const bn = b.presence.next_available ? new Date(b.presence.next_available).getTime() : Infinity;
      if (an !== bn) return an - bn;
    }
    return b.rating - a.rating;
  });

  return withPresence.slice(0, 5);
}

const LEGACY_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The wizard's doctor_schedules rows are the real source of truth, but the
// original available_days/available_hours_start/available_hours_end columns
// are kept for backward compat — this derives a best-effort summary into
// them whenever a schedule is saved, so nothing already reading them breaks.
function deriveLegacyAvailability(rows: { day_of_week: number; start_time: string; end_time: string }[]) {
  if (!rows.length) return { available_days: [], available_hours_start: null, available_hours_end: null };
  const days = Array.from(new Set(rows.map((r) => LEGACY_DAY_NAMES[r.day_of_week])));
  const starts = [...rows.map((r) => r.start_time)].sort();
  const ends = [...rows.map((r) => r.end_time)].sort();
  return { available_days: days, available_hours_start: starts[0], available_hours_end: ends[ends.length - 1] };
}

// Inserts the doctor row (always registration_status:'pending',
// pmdc_verified:false, is_active:false — the caller/route additionally
// strips any verification fields from the raw request body before this ever
// runs, so there is no path by which a doctor can self-verify) plus their
// initial weekly schedule.
export async function registerDoctor(
  db: SupabaseClient,userId: string, input: DoctorRegisterInput): Promise<Doctor | null> {
  const admin = db;
  const legacy = deriveLegacyAvailability(input.schedule);
  const { data, error } = await admin
    .from("doctors")
    .insert({
      user_id: userId,
      full_name: input.full_name,
      cnic: input.cnic,
      email: input.email,
      phone: input.phone,
      whatsapp: input.whatsapp || null,
      pmdc_number: input.pmdc_number,
      pmdc_registration_type: input.pmdc_registration_type,
      pmdc_expiry_date: input.pmdc_expiry_date,
      specialization: input.specialization,
      sub_specialization: input.sub_specialization || null,
      qualifications: input.qualifications,
      year_of_graduation: input.year_of_graduation,
      experience_years: input.experience_years,
      languages: input.languages,
      clinic_name: input.clinic_name,
      clinic_address: input.clinic_address,
      city: input.city,
      accepts_online: input.accepts_online,
      accepts_walk_in: input.accepts_walk_in,
      consultation_fee_pkr: input.consultation_fee_pkr,
      max_daily_appointments: input.max_daily_appointments,
      bio: input.bio || null,
      pmdc_certificate_url: input.pmdc_certificate_url,
      degree_certificate_url: input.degree_certificate_url,
      cnic_front_url: input.cnic_front_url,
      profile_photo_url: input.profile_photo_url || null,
      registration_status: "pending",
      pmdc_verified: false,
      is_active: false,
      ...legacy,
    })
    .select("*")
    .single();
  if (error || !data) return null;

  if (input.schedule.length) {
    await admin.from("doctor_schedules").insert(input.schedule.map((s) => ({ doctor_id: data.id, ...s })));
  }
  return data as Doctor;
}

export async function isPmdcNumberTaken(
  db: SupabaseClient,pmdcNumber: string): Promise<boolean> {
  const { data, error } = await db.rpc("pmdc_number_taken", { candidate: pmdcNumber });
  if (!error && typeof data === "boolean") return data;
  // Before the migration is applied, a direct read still catches numbers the
  // caller is allowed to see. The unique constraint remains the backstop.
  const { data: row } = await db.from("doctors").select("id").eq("pmdc_number", pmdcNumber).maybeSingle();
  return !!row;
}

// ---------- Patients ----------

interface PatientProfileInput {
  full_name: string;
  age?: number;
  gender?: "male" | "female" | "other";
  phone: string;
  known_allergies?: string[];
  current_medications?: string[];
}

// Patients don't have their own onboarding step — a profile is created (or
// refreshed) the moment they book their first appointment.
export async function getOrCreatePatientForUser(
  db: SupabaseClient,userId: string, profile: PatientProfileInput): Promise<Patient | null> {
  const admin = db;
  const { data: existing } = await admin.from("patients").select("*").eq("user_id", userId).maybeSingle();
  if (existing) {
    const { data, error } = await admin
      .from("patients")
      .update({
        full_name: profile.full_name,
        age: profile.age ?? existing.age,
        gender: profile.gender ?? existing.gender,
        phone: profile.phone,
        known_allergies: profile.known_allergies?.length ? profile.known_allergies : existing.known_allergies,
        current_medications: profile.current_medications?.length ? profile.current_medications : existing.current_medications,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return existing as Patient;
    return data as Patient;
  }
  const { data, error } = await admin
    .from("patients")
    .insert({
      user_id: userId,
      full_name: profile.full_name,
      age: profile.age,
      gender: profile.gender,
      phone: profile.phone,
      known_allergies: profile.known_allergies || [],
      current_medications: profile.current_medications || [],
    })
    .select("*")
    .single();
  if (error) return null;
  return data as Patient;
}

export async function getPatientById(
  db: SupabaseClient,patientId: string): Promise<Patient | null> {
  const admin = db;
  const { data, error } = await admin.from("patients").select("*").eq("id", patientId).maybeSingle();
  if (error || !data) return null;
  return data as Patient;
}

// ---------- Appointments ----------

interface CreateAppointmentInput {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  type: "online" | "walk_in";
  symptoms_description?: string;
  ai_suggested_specialization?: string;
  ai_symptom_analysis?: Record<string, unknown>;
  session_id?: string;
}

export async function createAppointment(
  db: SupabaseClient,input: CreateAppointmentInput): Promise<Appointment | null> {
  const admin = db;
  const { data, error } = await admin.from("appointments").insert(input).select("*").single();
  if (error) return null;
  return data as Appointment;
}

export async function updateAppointmentStatus(
  db: SupabaseClient,
  appointmentId: string,
  status: Appointment["status"]
): Promise<Appointment | null> {
  const { data, error } = await db
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .select("*")
    .single();
  if (error) return null;
  return data as Appointment;
}

export async function getAppointmentWithParties(
  db: SupabaseClient,
  appointmentId: string
): Promise<{ appointment: Appointment; doctor: Doctor; patient: Patient } | null> {
  const admin = db;
  const { data: appointment, error } = await admin.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
  if (error || !appointment) return null;
  const [{ data: doctor }, { data: patient }] = await Promise.all([
    admin.from("doctors").select("*").eq("id", appointment.doctor_id).maybeSingle(),
    admin.from("patients").select("*").eq("id", appointment.patient_id).maybeSingle(),
  ]);
  if (!doctor || !patient) return null;
  return { appointment: appointment as Appointment, doctor: doctor as Doctor, patient: patient as Patient };
}

export async function listDoctorAppointmentsToday(
  db: SupabaseClient,doctorId: string): Promise<Appointment[]> {
  const admin = db;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("appointments")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("appointment_date", today)
    .order("appointment_time", { ascending: true });
  if (error) return [];
  return (data || []) as Appointment[];
}

// ---------- Consultations (the call/visit record) ----------

export async function createConsultation(
  db: SupabaseClient,appointmentId: string, doctorId: string, patientId: string): Promise<Consultation | null> {
  const admin = db;
  const { data, error } = await admin
    .from("consultations")
    .insert({ appointment_id: appointmentId, doctor_id: doctorId, patient_id: patientId })
    .select("*")
    .single();
  if (error) return null;
  return data as Consultation;
}

export async function getConsultation(
  db: SupabaseClient,consultationId: string): Promise<Consultation | null> {
  const admin = db;
  const { data, error } = await admin.from("consultations").select("*").eq("id", consultationId).maybeSingle();
  if (error || !data) return null;
  return data as Consultation;
}

export async function startCallRecording(
  db: SupabaseClient,consultationId: string) {
  const admin = db;
  await admin.from("consultations").update({ call_started_at: new Date().toISOString() }).eq("id", consultationId);
}

export async function setCallConsent(
  db: SupabaseClient,consultationId: string, party: "patient" | "doctor", consents: boolean) {
  const admin = db;
  const column = party === "patient" ? "call_recording_consent_patient" : "call_recording_consent_doctor";
  const { data, error } = await admin
    .from("consultations")
    .update({ [column]: consents })
    .eq("id", consultationId)
    .select("*")
    .single();
  if (error) return null;
  return data as Consultation;
}

export async function endCall(
  db: SupabaseClient,consultationId: string, durationSeconds: number, doctorNotes: string) {
  const admin = db;
  const { data, error } = await admin
    .from("consultations")
    .update({
      call_ended_at: new Date().toISOString(),
      call_duration_seconds: durationSeconds,
      doctor_notes: doctorNotes,
    })
    .eq("id", consultationId)
    .select("*")
    .single();
  if (error) return null;
  return data as Consultation;
}

export async function saveVisitSummary(
  db: SupabaseClient,consultationId: string, summary: string) {
  const admin = db;
  await admin.from("consultations").update({ ai_visit_summary: summary }).eq("id", consultationId);
}

// ---------- Real Twilio calling ----------

export async function saveConsultationCallSid(
  db: SupabaseClient,consultationId: string, callSid: string): Promise<void> {
  const admin = db;
  await admin.from("consultations").update({ twilio_call_sid: callSid }).eq("id", consultationId);
}

export async function markCallEnded(
  db: SupabaseClient,consultationId: string, durationSeconds: number | null): Promise<void> {
  const admin = db;
  await admin
    .from("consultations")
    .update({ call_ended_at: new Date().toISOString(), call_duration_seconds: durationSeconds })
    .eq("id", consultationId);
}

export async function saveCallRecording(
  db: SupabaseClient,consultationId: string, recordingUrl: string, transcript: string): Promise<void> {
  const admin = db;
  await admin.from("consultations").update({ call_recording_url: recordingUrl, ai_transcript: transcript }).eq("id", consultationId);
}

export async function saveDoctorSignature(
  db: SupabaseClient,doctorId: string, signaturePath: string): Promise<void> {
  const admin = db;
  await admin.from("doctors").update({ signature_url: signaturePath }).eq("id", doctorId);
}

// ---------- Prescriptions ----------

export async function savePrescriptionDraft(
  db: SupabaseClient,
  consultationId: string,
  doctorId: string,
  patientId: string,
  doctorPmdcNumber: string,
  draft: PrescriptionData,
  warnings: string[],
  drugInteractions: string[]
): Promise<Prescription | null> {
  const admin = db;
  const { data, error } = await admin
    .from("prescriptions")
    .insert({
      consultation_id: consultationId,
      doctor_id: doctorId,
      patient_id: patientId,
      doctor_pmdc_number: doctorPmdcNumber,
      status: "draft",
      ai_generated_prescription: draft,
      warnings,
      drug_interactions: drugInteractions,
    })
    .select("*")
    .single();
  if (error) return null;
  return data as Prescription;
}

export async function getPrescription(
  db: SupabaseClient,prescriptionId: string): Promise<Prescription | null> {
  const admin = db;
  const { data, error } = await admin.from("prescriptions").select("*").eq("id", prescriptionId).maybeSingle();
  if (error || !data) return null;
  return data as Prescription;
}

export async function listPendingPrescriptions(
  db: SupabaseClient,doctorId: string): Promise<Prescription[]> {
  const admin = db;
  const { data, error } = await admin
    .from("prescriptions")
    .select("*")
    .eq("doctor_id", doctorId)
    .in("status", ["draft", "pending_review", "revised"])
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []) as Prescription[];
}

// Authorization gate for the review endpoint — the single most safety-critical
// check in this module. Returns the doctor row only if the requesting user is
// a PMDC-verified doctor AND is the doctor assigned to this prescription.
export async function verifyDoctorForPrescription(
  db: SupabaseClient,userId: string, prescriptionId: string): Promise<{ doctor: Doctor; prescription: Prescription } | null> {
  const prescription = await getPrescription(db, prescriptionId);
  if (!prescription) return null;
  const doctor = await getDoctorByUserId(db, userId);
  if (!doctor || !doctor.pmdc_verified || doctor.registration_status !== "verified" || !doctor.is_active) return null;
  if (doctor.id !== prescription.doctor_id) return null;
  return { doctor, prescription };
}

interface ReviewResult {
  prescription: Prescription;
}

export async function approvePrescription(
  db: SupabaseClient,
  prescriptionId: string,
  doctorId: string,
  finalContent: PrescriptionData
): Promise<ReviewResult | null> {
  const admin = db;
  const signedAt = new Date().toISOString();
  const signatureHash = createHash("sha256").update(`${doctorId}:${JSON.stringify(finalContent)}:${signedAt}`).digest("hex");
  const { data, error } = await admin
    .from("prescriptions")
    .update({
      status: "approved",
      doctor_edited_prescription: finalContent,
      final_prescription: finalContent,
      doctor_signature_hash: signatureHash,
      doctor_signed_at: signedAt,
      updated_at: signedAt,
    })
    .eq("id", prescriptionId)
    .select("*")
    .single();
  if (error) return null;
  return { prescription: data as Prescription };
}

export async function rejectPrescription(
  db: SupabaseClient,prescriptionId: string, reason: string): Promise<ReviewResult | null> {
  const admin = db;
  const { data, error } = await admin
    .from("prescriptions")
    .update({ status: "rejected", rejection_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", prescriptionId)
    .select("*")
    .single();
  if (error) return null;
  return { prescription: data as Prescription };
}

export async function editPrescription(
  db: SupabaseClient,prescriptionId: string, edited: PrescriptionData): Promise<ReviewResult | null> {
  const admin = db;
  const { data, error } = await admin
    .from("prescriptions")
    .update({ status: "revised", doctor_edited_prescription: edited, updated_at: new Date().toISOString() })
    .eq("id", prescriptionId)
    .select("*")
    .single();
  if (error) return null;
  return { prescription: data as Prescription };
}

export async function savePrescriptionPdfUrl(
  db: SupabaseClient,prescriptionId: string, url: string) {
  const admin = db;
  await admin.from("prescriptions").update({ pdf_url: url }).eq("id", prescriptionId);
}

// Stores a durable copy in the private "prescriptions" bucket when a doctor
// approves. The user client uploads it; storage policies allow the assigned
// doctor to write `{doctor_id}/{prescription_id}.pdf` and the patient to read it.
export async function uploadPrescriptionPdf(
  db: SupabaseClient,path: string, bytes: Buffer): Promise<void> {
  const admin = db;
  await admin.storage.from("prescriptions").upload(path, bytes, { upsert: true, contentType: "application/pdf" });
}

// ---------- Dashboard ----------

export async function getDashboardData(
  db: SupabaseClient,doctorId: string) {
  const [todaysAppointments, pendingPrescriptions] = await Promise.all([
    listDoctorAppointmentsToday(db, doctorId),
    listPendingPrescriptions(db, doctorId),
  ]);
  const admin = db;
  const { data: recentConsultations } = await admin
    .from("consultations")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false })
    .limit(10);
  return { todaysAppointments, pendingPrescriptions, recentConsultations: (recentConsultations || []) as Consultation[] };
}

// ---------- Weekly schedule & availability exceptions ----------

export async function getDoctorScheduleAndExceptions(
  db: SupabaseClient,
  doctorId: string
): Promise<{ schedule: DoctorSchedule[]; exceptions: AvailabilityException[] }> {
  const admin = db;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: schedule }, { data: exceptions }] = await Promise.all([
    admin.from("doctor_schedules").select("*").eq("doctor_id", doctorId).eq("is_active", true).order("day_of_week"),
    admin.from("doctor_availability_exceptions").select("*").eq("doctor_id", doctorId).gte("exception_date", today).order("exception_date"),
  ]);
  return { schedule: (schedule || []) as DoctorSchedule[], exceptions: (exceptions || []) as AvailabilityException[] };
}

// Replace-all save (simplest way to guarantee no orphaned/overlapping rows
// from a prior save survive) — also refreshes the legacy summary columns.
export async function saveDoctorSchedule(
  db: SupabaseClient,doctorId: string, rows: ScheduleRowInput[]): Promise<DoctorSchedule[]> {
  const admin = db;
  await admin.from("doctor_schedules").delete().eq("doctor_id", doctorId);
  if (rows.length) {
    await admin.from("doctor_schedules").insert(rows.map((r) => ({ doctor_id: doctorId, ...r })));
  }
  await admin.from("doctors").update(deriveLegacyAvailability(rows)).eq("id", doctorId);
  const { data } = await admin.from("doctor_schedules").select("*").eq("doctor_id", doctorId).order("day_of_week");
  return (data || []) as DoctorSchedule[];
}

export async function upsertAvailabilityException(
  db: SupabaseClient,
  doctorId: string,
  input: AvailabilityExceptionInput
): Promise<AvailabilityException | null> {
  const admin = db;
  const { data, error } = await admin
    .from("doctor_availability_exceptions")
    .upsert(
      {
        doctor_id: doctorId,
        exception_date: input.exception_date,
        is_available: input.is_available,
        start_time: input.start_time || null,
        end_time: input.end_time || null,
        reason: input.reason || null,
      },
      { onConflict: "doctor_id,exception_date" }
    )
    .select("*")
    .single();
  if (error) return null;
  return data as AvailabilityException;
}

export async function deleteAvailabilityException(
  db: SupabaseClient,doctorId: string, exceptionDate: string): Promise<void> {
  const admin = db;
  await admin.from("doctor_availability_exceptions").delete().eq("doctor_id", doctorId).eq("exception_date", exceptionDate);
}

// ---------- Presence ----------

export async function recordHeartbeat(
  db: SupabaseClient,
  doctorId: string,
  status?: "available" | "busy" | "on_break" | "do_not_disturb",
  resetOverride?: boolean
): Promise<{ doctor: Doctor; presence: PresenceResult } | null> {
  const admin = db;
  const now = new Date();
  const patch: Record<string, unknown> = { last_seen_at: now.toISOString(), is_online: true };
  if (resetOverride) {
    patch.manual_status_override = null;
    patch.override_expires_at = null;
  } else if (status) {
    patch.manual_status_override = status;
    patch.override_expires_at = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
  }

  const { data: updated, error } = await admin.from("doctors").update(patch).eq("id", doctorId).select("*").single();
  if (error || !updated) return null;
  const doctor = updated as Doctor;

  const { schedule, exceptions } = await getDoctorScheduleAndExceptions(db, doctorId);
  const presence = computePresence(doctor, schedule, exceptions, now);
  await admin.from("doctors").update({ availability_status: presence.status }).eq("id", doctorId);
  await admin
    .from("doctor_presence_log")
    .insert({ doctor_id: doctorId, status: presence.status, source: resetOverride ? "manual" : status ? "manual" : "heartbeat" });

  return { doctor: { ...doctor, availability_status: presence.status }, presence };
}

export async function markDoctorOffline(
  db: SupabaseClient,doctorId: string, source: "timeout" | "logout"): Promise<void> {
  const admin = db;
  await admin.from("doctors").update({ is_online: false, availability_status: "offline" }).eq("id", doctorId);
  await admin.from("doctor_presence_log").insert({ doctor_id: doctorId, status: "offline", source });
}

// Flips any doctor whose heartbeat has gone stale (>2min) back to offline,
// and clears any manual override that's past its 4-hour expiry. Called from
// the sweep endpoint, which is itself throttled — see app/api/doctor/presence/sweep/route.ts.
export async function sweepStalePresence(): Promise<number> {
  const admin = serviceClient();
  const staleCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: stale } = await admin.from("doctors").select("id").eq("is_online", true).lt("last_seen_at", staleCutoff);
  const staleIds = (stale || []).map((d: { id: string }) => d.id);
  if (staleIds.length) {
    await admin.from("doctors").update({ is_online: false, availability_status: "offline" }).in("id", staleIds);
    await admin
      .from("doctor_presence_log")
      .insert(staleIds.map((id: string) => ({ doctor_id: id, status: "offline", source: "timeout" })));
  }

  const { data: expiredOverrides } = await admin
    .from("doctors")
    .select("id")
    .not("manual_status_override", "is", null)
    .lt("override_expires_at", new Date().toISOString());
  const expiredIds = (expiredOverrides || []).map((d: { id: string }) => d.id);
  if (expiredIds.length) {
    await admin.from("doctors").update({ manual_status_override: null, override_expires_at: null }).in("id", expiredIds);
  }

  return staleIds.length;
}

// Part 9 — a verified doctor whose PMDC registration has expired loses
// clinical access automatically. Runs inside the same sweep endpoint.
export async function sweepExpiredPmdc(): Promise<number> {
  const admin = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: expired } = await admin
    .from("doctors")
    .select("id, user_id, full_name, registration_status")
    .eq("pmdc_verified", true)
    .not("pmdc_expiry_date", "is", null)
    .lt("pmdc_expiry_date", today);
  const rows = (expired || []) as { id: string; user_id: string | null; full_name: string; registration_status: string }[];
  if (!rows.length) return 0;

  const ids = rows.map((r) => r.id);
  await admin.from("doctors").update({ registration_status: "suspended", pmdc_verified: false, is_active: false }).in("id", ids);

  for (const row of rows) {
    await logDoctorVerification(admin, row.id, row.registration_status, "suspended", null, "Automatic suspension: PMDC registration expired");
    if (row.user_id) {
      await createNotification(
        admin,
        row.user_id,
        "pmdc_expired",
        "Your PMDC registration has expired",
        "Your account has been automatically suspended. Renew your PMDC registration and upload the updated certificate to restore access.",
        "/doctor/dashboard"
      );
    }
  }
  return rows.length;
}

// Warns doctors within 60 days of expiry, once (pmdc_expiry_warned_at guards
// against renotifying on every sweep).
export async function warnExpiringPmdc(): Promise<number> {
  const admin = serviceClient();
  const today = new Date();
  const warnBy = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: expiring } = await admin
    .from("doctors")
    .select("id, user_id, pmdc_expiry_date")
    .eq("pmdc_verified", true)
    .is("pmdc_expiry_warned_at", null)
    .not("pmdc_expiry_date", "is", null)
    .lte("pmdc_expiry_date", warnBy)
    .gte("pmdc_expiry_date", today.toISOString().slice(0, 10));
  const rows = (expiring || []) as { id: string; user_id: string | null; pmdc_expiry_date: string }[];
  for (const row of rows) {
    await admin.from("doctors").update({ pmdc_expiry_warned_at: new Date().toISOString() }).eq("id", row.id);
    if (row.user_id) {
      await createNotification(
        admin,
        row.user_id,
        "pmdc_expiring_soon",
        "Your PMDC registration is expiring soon",
        `Your registration expires on ${row.pmdc_expiry_date}. Please renew and upload your updated certificate to avoid suspension.`,
        "/doctor/dashboard"
      );
    }
  }
  return rows.length;
}

// Drains "notify me when available" requests — checked on every sweep rather
// than on a presence "flip" event (there's no cron in this app, and sweep
// already runs on every patient search, so this piggybacks on it).
export async function drainNotifyRequests(): Promise<number> {
  const admin = serviceClient();
  const { data: pending } = await admin.from("doctor_notify_requests").select("*").eq("notified", false);
  const rows = (pending || []) as { id: string; patient_user_id: string; doctor_id: string }[];
  if (!rows.length) return 0;

  const doctorIds = Array.from(new Set(rows.map((r) => r.doctor_id)));
  let notifiedCount = 0;
  for (const doctorId of doctorIds) {
    const doctor = await getDoctorById(admin, doctorId);
    if (!doctor) continue;
    const { schedule, exceptions } = await getDoctorScheduleAndExceptions(admin, doctorId);
    const presence = computePresence(doctor, schedule, exceptions, new Date());
    if (!presence.is_bookable) continue;

    const requestsForDoctor = rows.filter((r) => r.doctor_id === doctorId);
    for (const req of requestsForDoctor) {
      await createNotification(
        admin,
        req.patient_user_id,
        "doctor_available",
        `Dr. ${doctor.full_name} is now available`,
        "They're online now — book your appointment before the slot fills up.",
        "/studio"
      );
      await admin.from("doctor_notify_requests").update({ notified: true }).eq("id", req.id);
      notifiedCount++;
    }
  }
  return notifiedCount;
}

export async function createDoctorNotifyRequest(
  db: SupabaseClient,patientUserId: string, doctorId: string): Promise<void> {
  const admin = db;
  await admin.from("doctor_notify_requests").insert({ patient_user_id: patientUserId, doctor_id: doctorId });
}

// ---------- Admin: verification queue ----------

export async function listDoctorsByStatus(status: RegistrationStatus): Promise<Doctor[]> {
  const admin = serviceClient();
  const { data, error } = await admin
    .from("doctors")
    .select("*")
    .eq("registration_status", status)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data || []) as Doctor[];
}

export async function countDoctorsByStatus(): Promise<Record<RegistrationStatus, number>> {
  const admin = serviceClient();
  const { data } = await admin.from("doctors").select("registration_status");
  const counts: Record<RegistrationStatus, number> = { pending: 0, under_review: 0, verified: 0, rejected: 0, suspended: 0 };
  (data || []).forEach((d: { registration_status: RegistrationStatus }) => {
    counts[d.registration_status] = (counts[d.registration_status] || 0) + 1;
  });
  return counts;
}

export async function logDoctorVerification(
  db: SupabaseClient,
  doctorId: string,
  previousStatus: string | null,
  newStatus: string,
  changedBy: string | null,
  notes?: string
): Promise<void> {
  const admin = db;
  await admin
    .from("doctor_verification_log")
    .insert({ doctor_id: doctorId, previous_status: previousStatus, new_status: newStatus, changed_by: changedBy, notes: notes || null });
}

// The only function in the codebase that may ever set pmdc_verified: true.
export async function approveDoctor(doctorId: string, adminUserId: string): Promise<Doctor | null> {
  const admin = serviceClient();
  const doctor = await getDoctorById(admin, doctorId);
  if (!doctor) return null;
  const { data, error } = await admin
    .from("doctors")
    .update({
      registration_status: "verified",
      pmdc_verified: true,
      is_active: true,
      verified_at: new Date().toISOString(),
      verified_by: adminUserId,
      rejection_reason: null,
      registration_note: null,
    })
    .eq("id", doctorId)
    .select("*")
    .single();
  if (error) return null;
  await logDoctorVerification(admin, doctorId, doctor.registration_status, "verified", adminUserId);
  if (doctor.user_id) {
    await createNotification(admin, doctor.user_id, "verification_approved", "You're verified!", "Your PMDC registration is confirmed — you can now accept patients and sign prescriptions.", "/doctor/dashboard");
  }
  return data as Doctor;
}

export async function requestMoreInfo(doctorId: string, adminUserId: string, note: string): Promise<Doctor | null> {
  const admin = serviceClient();
  const doctor = await getDoctorById(admin, doctorId);
  if (!doctor) return null;
  const { data, error } = await admin
    .from("doctors")
    .update({ registration_status: "under_review", registration_note: note })
    .eq("id", doctorId)
    .select("*")
    .single();
  if (error) return null;
  await logDoctorVerification(admin, doctorId, doctor.registration_status, "under_review", adminUserId, note);
  if (doctor.user_id) {
    await createNotification(admin, doctor.user_id, "more_info_requested", "More information needed", note, "/doctor/dashboard");
  }
  return data as Doctor;
}

export async function rejectDoctor(doctorId: string, adminUserId: string, reason: string): Promise<Doctor | null> {
  const admin = serviceClient();
  const doctor = await getDoctorById(admin, doctorId);
  if (!doctor) return null;
  const { data, error } = await admin
    .from("doctors")
    .update({ registration_status: "rejected", rejection_reason: reason, pmdc_verified: false })
    .eq("id", doctorId)
    .select("*")
    .single();
  if (error) return null;
  await logDoctorVerification(admin, doctorId, doctor.registration_status, "rejected", adminUserId, reason);
  if (doctor.user_id) {
    await createNotification(admin, doctor.user_id, "verification_rejected", "Registration rejected", reason, "/doctor/dashboard");
  }
  return data as Doctor;
}

export async function suspendDoctor(
  doctorId: string,
  adminUserId: string,
  reason: string
): Promise<{ doctor: Doctor; flaggedPrescriptionIds: string[] } | null> {
  const admin = serviceClient();
  const doctor = await getDoctorById(admin, doctorId);
  if (!doctor) return null;
  const { data, error } = await admin
    .from("doctors")
    .update({ registration_status: "suspended", pmdc_verified: false, is_active: false, rejection_reason: reason })
    .eq("id", doctorId)
    .select("*")
    .single();
  if (error) return null;
  await logDoctorVerification(admin, doctorId, doctor.registration_status, "suspended", adminUserId, reason);

  const { data: pending } = await admin
    .from("prescriptions")
    .select("id")
    .eq("doctor_id", doctorId)
    .in("status", ["draft", "pending_review", "revised"]);
  const flaggedPrescriptionIds = ((pending || []) as { id: string }[]).map((p) => p.id);
  if (flaggedPrescriptionIds.length) {
    await admin.from("clinical_audit_log").insert(
      flaggedPrescriptionIds.map((id) => ({
        prescription_id: id,
        consultation_id: null,
        actor: "system",
        action: "flagged_doctor_suspended",
        details: { reason },
      }))
    );
  }
  if (doctor.user_id) {
    await createNotification(admin, doctor.user_id, "verification_suspended", "Account suspended", reason, "/doctor/dashboard");
  }
  return { doctor: data as Doctor, flaggedPrescriptionIds };
}

// ---------- Audit log (mandatory on every clinical action) ----------

export async function logClinicalAudit(
  db: SupabaseClient,
  consultationId: string | null,
  prescriptionId: string | null,
  actor: "ai" | "doctor" | "patient" | "system",
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const admin = db;
  await admin.from("clinical_audit_log").insert({
    consultation_id: consultationId,
    prescription_id: prescriptionId,
    actor,
    action,
    details,
  });
}
