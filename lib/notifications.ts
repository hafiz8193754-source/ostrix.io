import { createClient } from "@supabase/supabase-js";

import type { Notification } from "@/types";

// Server-only Supabase client (service role) — same per-file convention as
// lib/serverAuth.ts / lib/clinical.ts.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { persistSession: false } }
  );
}

// In-app only — no email/SMS/push. Fired on: registration submitted,
// verification approved/rejected/suspended, more-info requested, PMDC expiry
// warning, new appointment booked, appointment cancelled, doctor now available.
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
): Promise<void> {
  const admin = adminClient();
  await admin.from("notifications").insert({ user_id: userId, type, title, body: body || null, link: link || null });
}

export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as Notification[];
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const admin = adminClient();
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  const admin = adminClient();
  let query = admin.from("notifications").update({ is_read: true }).eq("user_id", userId);
  if (ids && ids.length) query = query.in("id", ids);
  await query;
}
