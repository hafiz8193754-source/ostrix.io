import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

type AuthClientOptions = {
  storage?: SupportedStorage;
  persistSession?: boolean;
  autoRefreshToken?: boolean;
  detectSessionInUrl?: boolean;
};

/**
 * One browser client, stored on globalThis, so a second copy of this module
 * (a duplicated chunk, or a dev reload) cannot start its own refresh.
 * Two clients refreshing the same token make Supabase revoke the session,
 * which signs the user out.
 */
const BROWSER_CLIENT = "__ostrixSupabase";

export function createAuthClient(options: AuthClientOptions = {}): SupabaseClient {
  const browser = typeof window !== "undefined";
  const persistSession = options.persistSession ?? true;
  return createClient(url, anon, {
    auth: {
      persistSession,
      autoRefreshToken: options.autoRefreshToken ?? persistSession,
      detectSessionInUrl: options.detectSessionInUrl ?? (browser && persistSession),
      storage: options.storage ?? (browser && persistSession ? window.localStorage : undefined),
    },
  });
}

function browserClient(): SupabaseClient {
  const scope = globalThis as typeof globalThis & { [BROWSER_CLIENT]?: SupabaseClient };
  if (!scope[BROWSER_CLIENT]) {
    scope[BROWSER_CLIENT] = createAuthClient({
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    });
  }
  return scope[BROWSER_CLIENT];
}

// The server render of a client component has no localStorage. That copy must
// not keep a session in memory and must not be reused for the real user.
export const supabase: SupabaseClient =
  typeof window === "undefined"
    ? createAuthClient({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false })
    : browserClient();
