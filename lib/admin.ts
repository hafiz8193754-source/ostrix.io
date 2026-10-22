import { createClient, type User } from "@supabase/supabase-js";

import { getUserFromRequest } from "@/lib/serverAuth";
import type { PlatformAdmin } from "@/types";

// Server-only Supabase client (service role) — mirrors lib/serverAuth.ts's
// adminClient(), kept local per this codebase's existing per-file convention.
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { persistSession: false } }
  );
}

export type AdminGuardResult = { ok: true; user: User; admin: PlatformAdmin } | { ok: false; status: number; error: string };

// The only gate on /api/admin/* routes and the /admin/doctors page. Being a
// "platform admin" is a row in platform_admins, inserted by hand — there is
// no self-service path to become one.
export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  const user = await getUserFromRequest(request);
  if (!user) return { ok: false, status: 401, error: "Please sign in." };

  const client = serviceClient();
  const { data, error } = await client.from("platform_admins").select("*").eq("user_id", user.id).maybeSingle();
  if (error || !data) return { ok: false, status: 403, error: "You do not have admin access." };

  return { ok: true, user, admin: data as PlatformAdmin };
}
