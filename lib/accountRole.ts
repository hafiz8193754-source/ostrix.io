import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountRole = "patient" | "doctor";
export type ResolvedRole = AccountRole | "admin" | null;

export function isAccountRole(v: unknown): v is AccountRole {
  return v === "patient" || v === "doctor";
}

/** Where a signed-in user lands for their role. */
export function destinationFor(role: ResolvedRole, hasDoctorProfile: boolean): string {
  if (role === "admin") return "/admin";
  if (role === "doctor") return hasDoctorProfile ? "/doctor/dashboard" : "/doctor/register";
  if (role === "patient") return "/my-care";
  return "/welcome";
}

/**
 * Pure inference used for existing accounts: a stored choice wins; otherwise a
 * doctor profile means doctor and a patient record means patient. Admin comes
 * only from platform_admins (never from user input).
 */
export function inferRole(input: { stored: string | null | undefined; isAdmin: boolean; hasDoctorProfile: boolean; hasPatientRecord: boolean }): ResolvedRole {
  if (input.isAdmin) return "admin";
  if (isAccountRole(input.stored)) return input.stored;
  if (input.hasDoctorProfile) return "doctor";
  if (input.hasPatientRecord) return "patient";
  return null;
}

export async function loadRoleFacts(db: SupabaseClient, admin: SupabaseClient | null, userId: string) {
  const [profile, doctor, patient, adminRow] = await Promise.all([
    db.from("profiles").select("account_role").eq("id", userId).maybeSingle(),
    db.from("doctors").select("id").eq("user_id", userId).limit(1),
    db.from("patients").select("id").eq("user_id", userId).limit(1),
    admin ? admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    stored: (profile.data?.account_role as string | null) ?? null,
    hasProfileRow: Boolean(profile.data),
    hasDoctorProfile: Boolean(doctor.data?.length),
    hasPatientRecord: Boolean(patient.data?.length),
    isAdmin: Boolean(adminRow.data),
  };
}
