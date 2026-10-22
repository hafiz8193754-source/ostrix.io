import { AsyncLocalStorage } from "async_hooks";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import type { AgentMode, ChatMessage, QuotaResult, Session, UsageStats } from "@/types";

// User routes authenticate with the anon key and the caller's session.
// The service-role key is optional: when it is set, database calls keep using
// it (RLS bypass, same as before). When it is missing, those calls use the
// anon key plus the user's Authorization header so RLS applies.
// Admin-only work (account deletion, doctor admin, cross-user notifications,
// presence sweeps) refuses with ServerNotConfiguredError instead of pretending
// the caller is signed out.

export const SERVER_NOT_CONFIGURED = "Server not fully configured";

export class ServerNotConfiguredError extends Error {
  readonly status = 503;
  constructor() {
    super(SERVER_NOT_CONFIGURED);
    this.name = "ServerNotConfiguredError";
  }
}

interface RequestAuth {
  accessToken: string;
  userId: string;
}

const requestAuth = new AsyncLocalStorage<RequestAuth>();

export function hasServiceRoleKey(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(key && key !== "placeholder");
}

function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://placeholder.supabase.co";
}

function anonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "placeholder";
}

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export function createAnonAuthClient(): SupabaseClient {
  return createClient(supabaseUrl(), anonKey(), { auth: authOptions });
}

export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl(), anonKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: authOptions,
  });
}

export function createServiceClient(): SupabaseClient {
  if (!hasServiceRoleKey()) throw new ServerNotConfiguredError();
  return createClient(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), { auth: authOptions });
}

// Service role when configured; otherwise the caller's JWT so Postgres sees
// auth.uid(). With neither, the anon key is used and RLS denies user rows.
export function dataClient(): SupabaseClient {
  if (hasServiceRoleKey()) return createServiceClient();
  const token = requestAuth.getStore()?.accessToken;
  if (token) return createUserClient(token);
  return createAnonAuthClient();
}

export function requireServiceClient(): SupabaseClient {
  return createServiceClient();
}

export function currentUserId(): string | null {
  return requestAuth.getStore()?.userId ?? null;
}

export function requestAuthToken(): string | null {
  return requestAuth.getStore()?.accessToken ?? null;
}

export function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
    try {
      value = decodeURIComponent(value);
    } catch {
      // keep the raw value
    }
    out[name] = value;
  }
  return out;
}

function decodeBase64Session(encoded: string): string | null {
  const payload = encoded.slice("base64-".length);
  for (const encoding of ["base64url", "base64"] as const) {
    try {
      const json = Buffer.from(payload, encoding).toString("utf8");
      const token = tokenFromUnknown(JSON.parse(json));
      if (token) return token;
    } catch {
      // try the other alphabet
    }
  }
  return null;
}

function tokenFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    return value.split(".").length === 3 ? value : null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.access_token === "string" && record.access_token) return record.access_token;
  if (record.currentSession) return tokenFromUnknown(record.currentSession);
  if (record.session) return tokenFromUnknown(record.session);
  return null;
}

export function tokenFromCookieValue(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("base64-")) return decodeBase64Session(value);
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      return tokenFromUnknown(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return tokenFromUnknown(value);
}

function readCookieValue(cookies: Record<string, string>, base: string): string | null {
  if (cookies[base]) return cookies[base];
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const part = cookies[`${base}.${i}`];
    if (part === undefined) break;
    parts.push(part);
  }
  return parts.length ? parts.join("") : null;
}

export function accessTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  const cookies = parseCookieHeader(request.headers.get("cookie") || "");
  const bases: string[] = [];
  for (const name of Object.keys(cookies)) {
    const match = name.match(/^(sb-.+-auth-token)(?:\.\d+)?$/);
    if (match && !bases.includes(match[1])) bases.push(match[1]);
  }
  if (cookies["sb-access-token"] !== undefined) bases.push("sb-access-token");

  for (const base of bases) {
    const raw = readCookieValue(cookies, base);
    if (!raw) continue;
    const token = tokenFromCookieValue(raw);
    if (token) return token;
  }
  return null;
}

async function userFromAccessToken(token: string): Promise<User | null> {
  const client = createAnonAuthClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  requestAuth.enterWith({ accessToken: token, userId: data.user.id });
  return data.user;
}

// Verifies a bearer token or a Supabase auth cookie with the anon key.
// Never uses the service-role key, so a missing service key is not a 401.
export async function getUserFromRequest(request: Request): Promise<User | null> {
  const token = accessTokenFromRequest(request);
  if (!token) return null;
  return userFromAccessToken(token);
}

export async function getUserFromAccessToken(token: string): Promise<User | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  return userFromAccessToken(trimmed);
}

// Signed-out callers stay 401. Signed-in callers of an admin-only route get
// 503 when the service-role key was never configured.
export function adminConfigGate(user: User | null): { ok: false; status: number; error: string } | { ok: true; user: User } {
  if (!user) return { ok: false, status: 401, error: "Please sign in." };
  if (!hasServiceRoleKey()) return { ok: false, status: 503, error: SERVER_NOT_CONFIGURED };
  return { ok: true, user };
}

// ---------- Quota ----------

export async function checkQuota(userId: string, agent: AgentMode, limit: number): Promise<QuotaResult> {
  const db = dataClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await db
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
  const db = dataClient();
  await db.from("generations").insert({ user_id: userId, agent, meta });
}

// ---------- Sessions (sidebar history — metadata only, no message content) ----------

export async function listSessions(userId: string): Promise<Session[]> {
  const db = dataClient();
  const { data, error } = await db
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data as Session[]) || [];
}

export async function createSession(userId: string, agent: AgentMode, title: string): Promise<Session | null> {
  const db = dataClient();
  const { data, error } = await db
    .from("sessions")
    .insert({ user_id: userId, agent, title })
    .select("*")
    .single();
  if (error) return null;
  return data as Session;
}

export async function renameSession(userId: string, sessionId: string, title: string): Promise<Session | null> {
  const db = dataClient();
  const { data, error } = await db
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
  const db = dataClient();
  const { error } = await db.from("sessions").delete().eq("id", sessionId).eq("user_id", userId);
  return !error;
}

// ---------- Messages (full thread content, scoped to a session the caller owns) ----------

export async function getSessionOwned(userId: string, sessionId: string): Promise<boolean> {
  const db = dataClient();
  const { data, error } = await db
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return !error && !!data;
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  const db = dataClient();
  const { data, error } = await db
    .from("messages")
    .select("content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data || []).map((row) => row.content as ChatMessage);
}

export async function appendMessage(sessionId: string, role: string, content: ChatMessage): Promise<void> {
  const db = dataClient();
  await Promise.all([
    db.from("messages").insert({ session_id: sessionId, role, content }),
    db.from("sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId),
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
  const db = dataClient();
  await Promise.all([
    db.from("generations").delete().eq("user_id", userId),
    db.from("sessions").delete().eq("user_id", userId),
  ]);
}

// ---------- Billing tab: Pro waitlist ----------

export async function insertWaitlistEmail(userId: string | null, email: string): Promise<void> {
  const db = dataClient();
  await db.from("waitlist_signups").insert({ user_id: userId, email });
}
