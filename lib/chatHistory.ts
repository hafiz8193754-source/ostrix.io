import type { SupabaseClient } from "@supabase/supabase-js";

// Patient chat history removal.
// A chat that is linked to an appointment holds the consultation thread the
// doctor reads (visit messages, prescriptions posted into it). Those are only
// hidden from the patient (sessions.hidden_at). Everything else is deleted for
// real (messages + artifacts cascade).

export interface RemoveResult {
  deleted: number;
  hidden: number;
}

export function splitLinked(ids: string[], linked: Set<string>): { toDelete: string[]; toHide: string[] } {
  return { toDelete: ids.filter((id) => !linked.has(id)), toHide: ids.filter((id) => linked.has(id)) };
}

async function linkedSessionIds(db: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await db.from("appointments").select("session_id").in("session_id", ids);
  if (error) throw new Error("Could not check linked consultations.");
  return new Set((data || []).map((r: { session_id: string | null }) => r.session_id).filter(Boolean) as string[]);
}

async function removeOwned(db: SupabaseClient, userId: string, ids: string[]): Promise<RemoveResult> {
  if (!ids.length) return { deleted: 0, hidden: 0 };
  const { toDelete, toHide } = splitLinked(ids, await linkedSessionIds(db, ids));
  if (toHide.length) {
    const { error } = await db
      .from("sessions")
      .update({ hidden_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", toHide);
    if (error) throw new Error("Could not hide chats.");
  }
  if (toDelete.length) {
    const { error } = await db.from("sessions").delete().eq("user_id", userId).in("id", toDelete);
    if (error) throw new Error("Could not delete chats.");
  }
  return { deleted: toDelete.length, hidden: toHide.length };
}

/** Remove one chat the user owns. Returns null when it isn't theirs / doesn't exist. */
export async function removeChat(db: SupabaseClient, userId: string, sessionId: string): Promise<RemoveResult | null> {
  const { data, error } = await db
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .is("hidden_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return removeOwned(db, userId, [sessionId]);
}

/** Clear every visible chat the user owns. */
export async function clearChatHistory(db: SupabaseClient, userId: string): Promise<RemoveResult> {
  const { data, error } = await db.from("sessions").select("id").eq("user_id", userId).is("hidden_at", null);
  if (error) throw new Error("Could not load chats.");
  return removeOwned(db, userId, (data || []).map((r: { id: string }) => r.id));
}
