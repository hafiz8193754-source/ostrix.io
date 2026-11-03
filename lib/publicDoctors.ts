import type { SupabaseClient } from "@supabase/supabase-js";

import { generateSlots, pkNowParts, type DaySlots } from "@/lib/slots";
import type { AvailabilityException, DoctorSchedule } from "@/types";

// Patient-facing doctor fields only — never CNIC, documents, phone, etc.
export const PUBLIC_DOCTOR_COLUMNS =
  "id, full_name, specialization, sub_specialization, qualifications, experience_years, clinic_name, city, consultation_fee_pkr, accepts_online, accepts_walk_in, bio, avatar_url, profile_photo_url, pmdc_number, languages";

export interface PublicDoctor {
  id: string;
  full_name: string;
  specialization: string;
  sub_specialization: string | null;
  qualifications: string;
  experience_years: number;
  clinic_name: string | null;
  city: string;
  consultation_fee_pkr: number;
  accepts_online: boolean;
  accepts_walk_in: boolean;
  bio: string | null;
  avatar_url: string | null;
  profile_photo_url: string | null;
  pmdc_number: string;
  languages: string[] | null;
}

export function doctorPhoto(d: Pick<PublicDoctor, "avatar_url" | "profile_photo_url">): string | null {
  // profile_photo_url from registration may be a private-bucket path; only use real URLs.
  const url = d.avatar_url || d.profile_photo_url;
  return url && /^https?:\/\//.test(url) ? url : null;
}

export async function listApprovedDoctors(db: SupabaseClient, filters: { specialization?: string; city?: string; q?: string } = {}): Promise<PublicDoctor[]> {
  let query = db
    .from("doctors")
    .select(PUBLIC_DOCTOR_COLUMNS)
    .eq("is_active", true)
    .eq("pmdc_verified", true)
    .eq("registration_status", "verified");
  if (filters.specialization) query = query.eq("specialization", filters.specialization);
  if (filters.city) query = query.ilike("city", filters.city);
  if (filters.q) query = query.ilike("full_name", `%${filters.q.replace(/[%_,()]/g, "")}%`);
  const { data, error } = await query.order("full_name").limit(100);
  if (error || !data) return [];
  return data as unknown as PublicDoctor[];
}

export async function getApprovedDoctor(db: SupabaseClient, id: string): Promise<PublicDoctor | null> {
  const { data } = await db
    .from("doctors")
    .select(PUBLIC_DOCTOR_COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .eq("pmdc_verified", true)
    .eq("registration_status", "verified")
    .maybeSingle();
  return (data as unknown as PublicDoctor) || null;
}

export async function getDoctorSlots(db: SupabaseClient, doctorId: string, days = 14, now = new Date()): Promise<DaySlots[]> {
  const { date: today } = pkNowParts(now);
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  const to = end.toISOString().slice(0, 10);
  const [{ data: schedules }, { data: exceptions }, { data: booked }] = await Promise.all([
    db.from("doctor_schedules").select("day_of_week, start_time, end_time, slot_duration_minutes, is_active").eq("doctor_id", doctorId).eq("is_active", true),
    db.from("doctor_availability_exceptions").select("exception_date, is_available, start_time, end_time").eq("doctor_id", doctorId).gte("exception_date", today).lte("exception_date", to),
    db.rpc("doctor_booked_slots", { p_doctor_id: doctorId, p_from: today, p_to: to }),
  ]);
  return generateSlots({
    schedules: (schedules || []) as DoctorSchedule[],
    exceptions: (exceptions || []) as AvailabilityException[],
    booked: ((booked || []) as { appointment_date: string; appointment_time: string }[]),
    days,
    now,
  });
}
