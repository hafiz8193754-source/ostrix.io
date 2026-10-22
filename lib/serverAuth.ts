import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import type { AgentMode, ChatMessage, Session } from "@/types";

// User routes authenticate with the anon key and the caller's session.
// getUserFromRequest returns an explicit per-request client: the service-role
// client when that key is set, otherwise the anon key plus the user's
// Authorization header. Callers pass `db` into every query. There is no
// ambient request storage.
// Account deletion, admin doctor review, and sweeps that touch other doctors
// still require the service-role key and return ServerNotConfiguredError.

export const SERVER_NOT_CONFIGURED = "Server not fully configured";

export class ServerNotConfiguredError extends Error {
  readonly status = 503;
  constructor() {
    super(SERVER_NOT_CONFIGURED);
    this.name = "ServerNotConfiguredError";
  }
}

export type RequestAuth = {
  user: User;
  token: string;
  db: SupabaseClient;
};

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

// The client route handlers must thread through. Service role when configured
// (RLS bypass); otherwise the anon key with this user's Authorization header.
export function clientForToken(accessToken: string): SupabaseClient {
  if (hasServiceRoleKey()) return createServiceClient();
  return createUserClient(accessToken);
}

export function requireServiceClient(): SupabaseClient {
  return createServiceClient();
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

async function userFromAccessToken(token: string): Promise<RequestAuth | null> {
  const client = createAnonAuthClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { user: data.user, token, db: clientForToken(token) };
}

// Verifies a bearer token or a Supabase auth cookie with the anon key.
// Never uses the service-role key for getUser, so a missing service key is not a 401.
export async function getUserFromRequest(request: Request): Promise<RequestAuth | null> {
  const token = accessTokenFromRequest(request);
  if (!token) return null;
  return userFromAccessToken(token);
}

export async function getUserFromAccessToken(token: string): Promise<RequestAuth | null> {
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

// ---------- Sessions (visit history — metadata only, no message content) ----------

export async function listSessions(db: SupabaseClient, userId: string): Promise<Session[]> {
  const { data, error } = await db
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("agent", "doctor")
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data as Session[]) || [];
}

export async function createSession(db: SupabaseClient, userId: string, agent: AgentMode, title: string): Promise<Session | null> {
  const { data, error } = await db
    .from("sessions")
    .insert({ user_id: userId, agent, title })
    .select("*")
    .single();
  if (error) return null;
  return data as Session;
}

export async function renameSession(db: SupabaseClient, userId: string, sessionId: string, title: string): Promise<Session | null> {
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

export async function deleteSession(db: SupabaseClient, userId: string, sessionId: string): Promise<boolean> {
  const { error } = await db.from("sessions").delete().eq("id", sessionId).eq("user_id", userId);
  return !error;
}

// ---------- Messages (full thread content, scoped to a session the caller owns) ----------

export async function getSessionOwned(db: SupabaseClient, userId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await db
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return !error && !!data;
}

export async function listMessages(db: SupabaseClient, sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from("messages")
    .select("content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data || []).map((row) => row.content as ChatMessage);
}

export async function appendMessage(db: SupabaseClient, sessionId: string, role: string, content: ChatMessage): Promise<void> {
  await Promise.all([
    db.from("messages").insert({ session_id: sessionId, role, content }),
    db.from("sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId),
  ]);
}

// ---------- Privacy: delete chat history ----------

export async function wipeUserData(db: SupabaseClient, userId: string): Promise<void> {
  await db.from("sessions").delete().eq("user_id", userId);
}
