import { NextResponse, type NextRequest } from "next/server";

// Signed-in sessions from PR #26 live in localStorage (sb-<project>-auth-token).
// Middleware only sees cookies, so it cannot tell a restored session from a
// signed-out visit. Redirecting /admin, /my-care, or /doctor/dashboard here
// would bounce people who are already signed in. Those pages wait for the
// client to restore the session and only then send a logged-out visitor to
// /login?next=...
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/my-care", "/doctor/dashboard"],
};
