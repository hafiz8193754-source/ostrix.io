import type { SupabaseClient } from "@supabase/supabase-js";

import type { Notification } from "@/types";

// In-app only — no email/SMS/push. A user inserts their own row under
// "Own notifications". Notifying the other party of a shared appointment is
// allowed by "Care participants notify each other". Anything else is rejected
// by RLS. Admin and sweep callers pass the service-role client.
export async function createNotification(
  db: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
): Promise<void> {
  const { error } = await db.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body: body || null,
    link: link || null,
  });
  if (error) throw new Error(error.message);
}

export async function listNotifications(db: SupabaseClient, userId: string, limit = 30): Promise<Notification[]> {
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as Notification[];
}

export async function countUnreadNotifications(db: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationsRead(db: SupabaseClient, userId: string, ids?: string[]): Promise<void> {
  let query = db.from("notifications").update({ is_read: true }).eq("user_id", userId);
  if (ids && ids.length) query = query.in("id", ids);
  await query;
}
