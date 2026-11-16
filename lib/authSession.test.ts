import { afterEach, describe, expect, it } from "vitest";
import type { SupportedStorage } from "@supabase/supabase-js";

import { LOADING_AUTH, loginPathFor, reduceAuth, shouldRedirectToLogin } from "@/lib/authGate";
import { createAuthClient } from "@/lib/supabaseClient";

function memoryStorage(): SupportedStorage & { readSession: () => { key: string; value: Record<string, unknown> } | null } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    readSession: () => {
      for (const [key, value] of items) {
        if (key.includes("-auth-token") && !key.includes("code-verifier")) return { key, value: JSON.parse(value) };
      }
      return null;
    },
  };
}

function user(id = "user-1") {
  return {
    id,
    aud: "authenticated",
    role: "authenticated",
    email: "patient@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
}

function session(access: string, refresh: string, expiresAt: number) {
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: "bearer",
    user: user(),
  };
}

describe("auth gate", () => {
  it("does not treat a session as signed-out while storage is still being read", () => {
    const earlyNull = reduceAuth(LOADING_AUTH, { session: null, from: "listener" });
    expect(earlyNull.status).toBe("loading");
    expect(shouldRedirectToLogin(earlyNull.status)).toBe(false);
  });

  it("stays signed in once storage returns a session, including after a token refresh", () => {
    const restored = reduceAuth(LOADING_AUTH, { session: { access_token: "first" }, from: "storage" });
    expect(restored.status).toBe("authenticated");
    expect(shouldRedirectToLogin(restored.status)).toBe(false);
    const refreshed = reduceAuth(restored, { session: { access_token: "second" }, from: "listener" });
    expect(refreshed.session?.access_token).toBe("second");
    expect(shouldRedirectToLogin(refreshed.status)).toBe(false);
  });

  it("sends the user to login only after a finished check finds no session, and remembers the page", () => {
    const signedOut = reduceAuth(LOADING_AUTH, { session: null, from: "storage" });
    expect(shouldRedirectToLogin(signedOut.status)).toBe(true);
    const hadSession = reduceAuth(LOADING_AUTH, { session: { access_token: "first" }, from: "storage" });
    const loggedOut = reduceAuth(hadSession, { session: null, from: "listener" });
    expect(shouldRedirectToLogin(loggedOut.status)).toBe(true);
    expect(loginPathFor("/my-care")).toBe(`/login?next=${encodeURIComponent("/my-care")}`);
    expect(loginPathFor("/visit/abc", "?tab=notes")).toBe(`/login?next=${encodeURIComponent("/visit/abc?tab=notes")}`);
  });
});

describe("supabase session persistence", () => {
  const clients: ReturnType<typeof createAuthClient>[] = [];

  afterEach(() => {
    for (const client of clients) client.auth.stopAutoRefresh();
    clients.length = 0;
  });

  it("keeps a signed-in user signed in after a new page load, refreshes an expired access token, and clears storage on logout", async () => {
    const storage = memoryStorage();
    let refreshToken = "refresh-1";
    let accessToken = "access-1";
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (target.includes("grant_type=password")) {
        return Response.json(session(accessToken, refreshToken, Math.floor(Date.now() / 1000) + 3600));
      }
      if (target.includes("grant_type=refresh_token")) {
        expect(body.refresh_token).toBe(refreshToken);
        refreshToken = "refresh-2";
        accessToken = "access-2";
        return Response.json(session(accessToken, refreshToken, Math.floor(Date.now() / 1000) + 3600));
      }
      if (target.includes("/logout")) return new Response(null, { status: 204 });
      throw new Error(`unexpected fetch ${target}`);
    }) as typeof fetch;

    const open = () => {
      const client = createAuthClient({ storage, detectSessionInUrl: false });
      clients.push(client);
      return client;
    };

    try {
      const signedIn = await open().auth.signInWithPassword({ email: "patient@example.com", password: "secret" });
      expect(signedIn.error).toBeNull();
      expect(signedIn.data.session?.access_token).toBe("access-1");

      const afterReload = await open().auth.getSession();
      expect(afterReload.data.session?.access_token).toBe("access-1");
      expect(afterReload.data.session?.user.email).toBe("patient@example.com");

      const saved = storage.readSession();
      expect(saved?.value.refresh_token).toBe("refresh-1");
      saved!.value.expires_at = Math.floor(Date.now() / 1000) - 120;
      saved!.value.expires_in = 0;
      await storage.setItem(saved!.key, JSON.stringify(saved!.value));

      const renewed = await open().auth.getSession();
      expect(renewed.error).toBeNull();
      expect(renewed.data.session?.access_token).toBe("access-2");
      expect(storage.readSession()?.value.refresh_token).toBe("refresh-2");

      const { error: signedOut } = await open().auth.signOut();
      expect(signedOut).toBeNull();
      const afterLogout = await open().auth.getSession();
      expect(afterLogout.data.session).toBeNull();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
