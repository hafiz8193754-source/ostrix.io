import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

import { createNotification } from "./notifications";
import {
  SERVER_NOT_CONFIGURED,
  ServerNotConfiguredError,
  accessTokenFromRequest,
  adminConfigGate,
  checkQuota,
  getUserFromRequest,
  hasServiceRoleKey,
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
      if (url.includes("/rest/v1/generations")) {
        return new Response(null, { status: 200, headers: { "content-range": "0-0/0" } });
      }
      return new Response("{}", { status: 201, headers: { "content-type": "application/json" } });
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

    const user = await getUserFromRequest(request);
    expect(user?.id).toBe("user-1");

    const authCall = calls.find((call) => call.url.includes("/auth/v1/user"));
    expect(authCall?.apikey).toBe("anon-public-key");
    expect(authCall?.authorization).toBe("Bearer user.access.jwt");
    expect(authCall?.apikey).not.toBe("placeholder");

    await checkQuota("user-1", "builder", 3);
    const quotaCall = calls.find((call) => call.url.includes("/rest/v1/generations"));
    expect(quotaCall?.apikey).toBe("anon-public-key");
    expect(quotaCall?.authorization).toBe("Bearer user.access.jwt");
  });

  it("keeps using the service role for database calls when that key exists", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    });
    const calls = installFetch();
    const user = await getUserFromRequest(
      new Request("https://ostrix.test/api/builder", { headers: { authorization: "Bearer user.access.jwt" } })
    );
    expect(user?.id).toBe("user-1");
    const authCall = calls.find((call) => call.url.includes("/auth/v1/user"));
    expect(authCall?.apikey).toBe("anon-public-key");

    await checkQuota("user-1", "farm", 3);
    const quotaCall = calls.find((call) => call.url.includes("/rest/v1/generations"));
    expect(quotaCall?.apikey).toBe("service-role-secret");
    expect(quotaCall?.authorization).toBe("Bearer service-role-secret");
  });

  it("lets a user write their own notification and refuses a cross-user one without the service key", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder",
    });
    const calls = installFetch();
    const user = await getUserFromRequest(
      new Request("https://ostrix.test/api/doctor/register", { headers: { authorization: "Bearer user.access.jwt" } })
    );
    expect(user?.id).toBe("user-1");

    await expect(createNotification("someone-else", "verification_approved", "You're verified!")).rejects.toBeInstanceOf(
      ServerNotConfiguredError
    );

    await createNotification(user!.id, "registration_submitted", "Registration submitted");
    const insert = calls.find((call) => call.url.includes("/rest/v1/notifications"));
    expect(insert?.apikey).toBe("anon-public-key");
    expect(insert?.authorization).toBe("Bearer user.access.jwt");
  });
});
