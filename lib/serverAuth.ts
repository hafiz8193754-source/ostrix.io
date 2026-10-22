import { createClient, type User } from "@supabase/supabase-js";

import type { AgentMode, ChatMessage, QuotaResult, Session, UsageStats } from "@/types";

// Server-only Supabase client (service role). Never expose this key to the browser.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { persistSession: false } }
  );
}

// Verifies the Bearer token from the request and returns the user, or null.
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

// Returns { allowed, used, limit } for this user + agent today, based on the generations table.
export async function checkQuota(userId: string, agent: AgentMode, limit: number): Promise<QuotaResult> {
  const admin = adminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await admin
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("agent", agent)
    .gte("created_at", startOfDay.toISOString());
  if (error) return { allowed: true, used: 0, limit }; // fail open, log in production
  const used = count || 0;
  return { allowed: used < limit, used, limit };
}

export async function recordGeneration(userId: string, agent: AgentMode, meta: Record<string, unknown>): Promise<void> {
  const admin = adminClient();
  await admin.from("generations").insert({ user_id: userId, agent, meta });
}

// ---------- Sessions (sidebar history — metadata only, no message content) ----------

export async function listSessions(userId: string): Promise<Session[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data as Session[]) || [];
}

export async function createSession(userId: string, agent: AgentMode, title: string): Promise<Session | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("sessions")
    .insert({ user_id: userId, agent, title })
    .select("*")
    .single();
  if (error) return null;
  return data as Session;
}

export async function renameSession(userId: string, sessionId: string, title: string): Promise<Session | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data as Session;
}

export async function deleteSession(userId: string, sessionId: string): Promise<boolean> {
  const admin = adminClient();
  const { error } = await admin.from("sessions").delete().eq("id", sessionId).eq("user_id", userId);
  return !error;
}

// ---------- Messages (full thread content, scoped to a session the caller owns) ----------

export async function getSessionOwned(userId: string, sessionId: string): Promise<boolean> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return !error && !!data;
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("messages")
    .select("content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data || []).map((row) => row.content as ChatMessage);
}

export async function appendMessage(sessionId: string, role: string, content: ChatMessage): Promise<void> {
  const admin = adminClient();
  await Promise.all([
    admin.from("messages").insert({ session_id: sessionId, role, content }),
    // Keep the sidebar's "most recently active" ordering accurate as a chat continues.
    admin.from("sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId),
  ]);
}

// ---------- Billing tab usage stats ----------

export async function getUsage(userId: string, builderLimit: number, farmLimit: number): Promise<UsageStats> {
  const [builder, farm] = await Promise.all([
    checkQuota(userId, "builder", builderLimit),
    checkQuota(userId, "farm", farmLimit),
  ]);
  return {
    builder: { used: builder.used, limit: builder.limit },
    farm: { used: farm.used, limit: farm.limit },
  };
}

// ---------- Privacy tab: delete-all-data ----------

export async function wipeUserData(userId: string): Promise<void> {
  const admin = adminClient();
  await Promise.all([
    admin.from("generations").delete().eq("user_id", userId),
    admin.from("sessions").delete().eq("user_id", userId),
  ]);
}

// ---------- Billing tab: Pro waitlist ----------

export async function insertWaitlistEmail(userId: string | null, email: string): Promise<void> {
  const admin = adminClient();
  await admin.from("waitlist_signups").insert({ user_id: userId, email });
}
