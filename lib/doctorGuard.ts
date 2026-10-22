import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getUserFromRequest } from "@/lib/serverAuth";
import { getDoctorByUserId } from "@/lib/clinical";
import type { Doctor } from "@/types";

export type DoctorGuardResult =
  | { ok: true; user: User; doctor: Doctor; db: SupabaseClient; token: string }
  | { ok: false; status: number; error: string };

// Every clinical route that performs a doctor action (drafting/signing a
// prescription, starting/ending a call, generating a visit summary) must
// call this instead of getUserFromRequest alone. Verification is re-checked
// live against the doctors row every time — never trusted from anything the
// client sends, and never inferred from presence data.
export async function requireVerifiedDoctor(request: Request): Promise<DoctorGuardResult> {
  const auth = await getUserFromRequest(request);
  if (!auth) return { ok: false, status: 401, error: "Please sign in." };

  const doctor = await getDoctorByUserId(auth.db, auth.user.id);
  if (!doctor) return { ok: false, status: 403, error: "No doctor profile found for this account." };

  if (!doctor.pmdc_verified || doctor.registration_status !== "verified" || !doctor.is_active) {
    return {
      ok: false,
      status: 403,
      error: "Your PMDC registration is pending verification. Clinical features unlock once verified.",
    };
  }

  return { ok: true, user: auth.user, doctor, db: auth.db, token: auth.token };
}
