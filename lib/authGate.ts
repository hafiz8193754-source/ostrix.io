export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthSnapshot = {
  status: AuthStatus;
  session: { access_token: string } | null;
  /** True once the stored session has been read (including a refresh of an expired access token). */
  settled: boolean;
};

export const LOADING_AUTH: AuthSnapshot = { status: "loading", session: null, settled: false };

/**
 * A null session from the auth listener is not proof the user is signed out
 * until the client has finished reading storage. That first read is what
 * restores a session after a reload and refreshes an expired access token.
 */
export function reduceAuth(
  state: AuthSnapshot,
  event: { session: { access_token: string } | null; from: "storage" | "listener" }
): AuthSnapshot {
  if (!state.settled && event.from === "listener" && !event.session) return state;
  return {
    settled: true,
    session: event.session,
    status: event.session ? "authenticated" : "anonymous",
  };
}

/** Only a finished check with no session should send the user to the login form. */
export function shouldRedirectToLogin(status: AuthStatus): boolean {
  return status === "anonymous";
}

/** Same-site return path. `search` is either "" or a string starting with "?". */
export function loginPathFor(pathname: string, search = ""): string {
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  return `/login?next=${encodeURIComponent(`${pathname}${query}`)}`;
}
