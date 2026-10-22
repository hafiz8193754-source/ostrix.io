import type { User } from "@supabase/supabase-js";

import { adminConfigGate, getUserFromRequest, requireServiceClient } from "@/lib/serverAuth";
import type { PlatformAdmin } from "@/types";

export type AdminGuardResult = { ok: true; user: User; admin: PlatformAdmin } | { ok: false; status: number; error: string };

// The only gate on /api/admin/* routes and the /admin/doctors page. Being a
// "platform admin" is a row in platform_admins, inserted by hand — there is
// no self-service path to become one.
export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  const auth = await getUserFromRequest(request);
  const gate = adminConfigGate(auth?.user ?? null);
  if (!gate.ok) return { ok: false, status: gate.status, error: gate.error };

  const client = requireServiceClient();
  const { data, error } = await client.from("platform_admins").select("*").eq("user_id", gate.user.id).maybeSingle();
  if (error || !data) return { ok: false, status: 403, error: "You do not have admin access." };

  return { ok: true, user: gate.user, admin: data as PlatformAdmin };
}
