import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Script outline for a live database after the migration is applied.
// This file does not call Supabase. It pins the policies that outline needs.
//
// 1. Patient signs in and opens /studio. The app creates a session with
//    agent "doctor" and stores the intake thread as that session's owner.
// 2. Patient POSTs symptoms to /api/doctor/analyze. clinicalAI returns a
//    specialization (no web-search tool). The route inserts clinical_audit_log
//    as actor "system" (emergency) or "ai" (analysis) with both foreign keys null.
// 3. Patient POSTs /api/doctor/appointment. Their patients row is created,
//    the appointment inserts as status pending against a verified active doctor,
//    the doctor is notified, and the audit row carries details.appointment_id.
// 4. Doctor POSTs /api/doctor/register. Own doctors, doctor_schedules, and a
//    doctor_verification_log row (pending, changed_by null) insert with the
//    user JWT. pmdc_number_taken answers without exposing other doctors.
//    Admin verification of that doctor still returns 503 "Server not fully
//    configured" until SUPABASE_SERVICE_ROLE_KEY is set.
// 5. Doctor POSTs /api/doctor/presence/heartbeat and later
//    /api/doctor/presence/offline. Both write only that doctor's presence row.
// 6. Doctor GETs /api/doctor/dashboard (today's appointments, including the
//    patient row) and PATCH /api/doctor/appointment to confirmed. The patient
//    is notified. The patient may PATCH only cancelled, or in_progress by
//    starting the call.
// 7. Either party POSTs /api/doctor/call. A consultation inserts, the
//    appointment moves to in_progress, and Twilio status/recording callbacks
//    carry that caller's access token so they write with the same user client.
// 8. The assigned doctor POSTs /api/doctor/prescription/draft, then
//    /api/doctor/prescription/review action approve. The PDF uploads to
//    prescriptions/{doctor_id}/{prescription_id}.pdf without the service role.
//    The patient is notified and can read that object. The patient GETs
//    /api/doctor/prescription/pdf.
export const PATIENT_DOCTOR_PRESCRIPTION_OUTLINE = [
  "patient intake session and /api/doctor/analyze",
  "patient books /api/doctor/appointment and notifies the doctor",
  "doctor registers, heartbeats, and confirms from the dashboard",
  "either party starts /api/doctor/call",
  "assigned doctor drafts, approves, and uploads the prescription PDF",
  "patient reads the prescription",
] as const;

const MIGRATION = path.join(process.cwd(), "supabase/migrations/20261022120000_doctor_owner_policies.sql");

const REQUIRED = [
  "Users insert own profile",
  "Users update own profile",
  "Users delete own profile",
  "Users insert own sessions",
  "Users update own sessions",
  "Users delete own sessions",
  "Users insert own messages",
  "Users update own messages",
  "Users delete own messages",
  "Assigned doctor inserts visit messages",
  "Patients insert own profile",
  "Patients update own profile",
  "Doctors read treating patients",
  "Patients book appointments",
  "Parties update appointments",
  "Parties insert consultations",
  "Parties update consultations",
  "Doctors insert prescriptions",
  "Doctors update prescriptions",
  "Actors insert clinical audit",
  "Doctors insert own presence",
  "Doctors insert own verification log",
  "Care participants notify each other",
  "Doctors upload prescription pdfs",
  "Doctors update prescription pdfs",
  "Parties read prescription pdfs",
  "pmdc_number_taken",
  "(select auth.uid())",
  "prescriptions",
];

describe("patient → doctor → prescription", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("covers intake, booking, the visit, and the signed prescription", () => {
    expect(PATIENT_DOCTOR_PRESCRIPTION_OUTLINE).toHaveLength(6);
    expect(PATIENT_DOCTOR_PRESCRIPTION_OUTLINE.join(" ")).toMatch(/patient/);
    expect(PATIENT_DOCTOR_PRESCRIPTION_OUTLINE.join(" ")).toMatch(/doctor/);
    expect(PATIENT_DOCTOR_PRESCRIPTION_OUTLINE.join(" ")).toMatch(/prescription/);
  });

  it("ships owner-scoped policies and does not open tables to every user", () => {
    for (const needle of REQUIRED) expect(sql).toContain(needle);
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/on public\.(generations|artifacts|waitlist_signups)/);
  });
});
