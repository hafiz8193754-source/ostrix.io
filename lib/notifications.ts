import type { Notification } from "@/types";
import { createUserClient, currentUserId, dataClient, hasServiceRoleKey, requestAuthToken, ServerNotConfiguredError } from "@/lib/serverAuth";

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
  const row = { user_id: userId, type, title, body: body || null, link: link || null };
  // Notifying somebody else bypasses RLS and needs the service role.
  // A user inserting their own row is allowed by "Own notifications".
  if (hasServiceRoleKey()) {
    await dataClient().from("notifications").insert(row);
    return;
  }
  const caller = currentUserId();
  const token = requestAuthToken();
  if (!caller || caller !== userId || !token) throw new ServerNotConfiguredError();
  await createUserClient(token).from("notifications").insert(row);
}

export async function listNotifications(userId: string, limit = 30): Promise<Notification[]> {
  const admin = dataClient();
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
  const admin = dataClient();
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  const admin = dataClient();
  let query = admin.from("notifications").update({ is_read: true }).eq("user_id", userId);
  if (ids && ids.length) query = query.in("id", ids);
  await query;
}
