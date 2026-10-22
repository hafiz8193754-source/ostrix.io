import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

import { createNotification } from "./notifications";
import {
  SERVER_NOT_CONFIGURED,
  accessTokenFromRequest,
  adminConfigGate,
  getUserFromRequest,
  hasServiceRoleKey,
  listSessions,
  tokenFromCookieValue,
} from "./serverAuth";

const ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const previous: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    if (!(key in previous)) previous[key] = process.env[key];
    if (key in values) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (!(key in previous)) continue;
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function userResponse(id = "user-1") {
  return new Response(
    JSON.stringify({
      id,
      aud: "authenticated",
      role: "authenticated",
      email: "patient@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function installFetch() {
  const calls: { url: string; apikey: string | null; authorization: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        apikey: headers.get("apikey"),
        authorization: headers.get("authorization"),
      });
      if (url.includes("/auth/v1/user")) return userResponse();
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    })
  );
  return calls;
}

describe("accessTokenFromRequest", () => {
  it("reads a bearer token", () => {
    const request = new Request("https://ostrix.test/api/profile", {
      headers: { authorization: "Bearer user.access.jwt" },
    });
    expect(accessTokenFromRequest(request)).toBe("user.access.jwt");
  });

  it("prefers the bearer token over a session cookie", () => {
    const request = new Request("https://ostrix.test/api/profile", {
      headers: {
        authorization: "Bearer from.header.jwt",
        cookie: "sb-access-token=from.cookie.jwt",
      },
    });
    expect(accessTokenFromRequest(request)).toBe("from.header.jwt");
  });

  it("reads a raw sb-access-token cookie", () => {
    const request = new Request("https://ostrix.test/api/sessions", {
      headers: { cookie: "sb-access-token=cookie.access.jwt; other=1" },
    });
    expect(accessTokenFromRequest(request)).toBe("cookie.access.jwt");
  });

  it("reads a base64 Supabase auth cookie, including chunked parts", () => {
    const session = JSON.stringify({ access_token: "chunked.access.jwt", refresh_token: "r" });
    const encoded = `base64-${Buffer.from(session).toString("base64url")}`;
    const mid = Math.floor(encoded.length / 2);
    const request = new Request("https://ostrix.test/api/sessions", {
      headers: {
        cookie: `sb-abc-auth-token.0=${encoded.slice(0, mid)}; sb-abc-auth-token.1=${encoded.slice(mid)}`,
      },
    });
    expect(accessTokenFromRequest(request)).toBe("chunked.access.jwt");
  });

  it("reads a JSON session cookie", () => {
    expect(tokenFromCookieValue(JSON.stringify({ access_token: "json.access.jwt" }))).toBe("json.access.jwt");
  });
});

describe("hasServiceRoleKey", () => {
  it("treats an unset, blank, or placeholder key as missing", () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(hasServiceRoleKey()).toBe(false);
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: "   " });
    expect(hasServiceRoleKey()).toBe(false);
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: "placeholder" });
    expect(hasServiceRoleKey()).toBe(false);
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: "service-role-secret" });
    expect(hasServiceRoleKey()).toBe(true);
  });
});

describe("adminConfigGate", () => {
  const user = { id: "user-1" } as User;

  it("returns 401 when nobody is signed in", () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(adminConfigGate(null)).toEqual({ ok: false, status: 401, error: "Please sign in." });
  });

  it("returns 503 instead of a fake 401 when the caller is signed in but the service key is missing", () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(adminConfigGate(user)).toEqual({ ok: false, status: 503, error: SERVER_NOT_CONFIGURED });
  });

  it("lets the route proceed when the service key is configured", () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: "service-role-secret" });
    expect(adminConfigGate(user)).toEqual({ ok: true, user });
  });
});

describe("session verification without a service-role key", () => {
  it("verifies the bearer token with the anon key and queries as that user", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });
    const calls = installFetch();
    const request = new Request("https://ostrix.test/api/profile", {
      headers: { authorization: "Bearer user.access.jwt" },
    });

    const auth = await getUserFromRequest(request);
    const { user, db } = auth!;
    expect(user?.id).toBe("user-1");

    const authCall = calls.find((call) => call.url.includes("/auth/v1/user"));
    expect(authCall?.apikey).toBe("anon-public-key");
    expect(authCall?.authorization).toBe("Bearer user.access.jwt");
    expect(authCall?.apikey).not.toBe("placeholder");

    await listSessions(db, user.id);
    const sessionCall = calls.find((call) => call.url.includes("/rest/v1/sessions"));
    expect(sessionCall?.apikey).toBe("anon-public-key");
    expect(sessionCall?.authorization).toBe("Bearer user.access.jwt");
  });

  it("keeps using the service role for database calls when that key exists", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    });
    const calls = installFetch();
    const auth = await getUserFromRequest(
      new Request("https://ostrix.test/api/doctor/dashboard", { headers: { authorization: "Bearer user.access.jwt" } })
    );
    expect(auth?.user.id).toBe("user-1");
    const authCall = calls.find((call) => call.url.includes("/auth/v1/user"));
    expect(authCall?.apikey).toBe("anon-public-key");

    await listSessions(auth!.db, auth!.user.id);
    const sessionCall = calls.find((call) => call.url.includes("/rest/v1/sessions"));
    expect(sessionCall?.apikey).toBe("service-role-secret");
    expect(sessionCall?.authorization).toBe("Bearer service-role-secret");
  });

  it("sends notification inserts with the user JWT and lets RLS decide the recipient", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder",
    });
    const calls = installFetch();
    const auth = await getUserFromRequest(
      new Request("https://ostrix.test/api/doctor/register", { headers: { authorization: "Bearer user.access.jwt" } })
    );
    expect(auth?.user.id).toBe("user-1");

    await createNotification(auth!.db, "someone-else", "appointment_booked", "New appointment");
    await createNotification(auth!.db, auth!.user.id, "registration_submitted", "Registration submitted");
    const inserts = calls.filter((call) => call.url.includes("/rest/v1/notifications"));
    expect(inserts).toHaveLength(2);
    expect(inserts.every((call) => call.apikey === "anon-public-key")).toBe(true);
    expect(inserts.every((call) => call.authorization === "Bearer user.access.jwt")).toBe(true);
  });
});
