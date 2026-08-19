import { type NextRequest, NextResponse } from "next/server";

/**
 * Drops a session cookie that Frappe no longer recognises, then sends the user
 * to sign in again.
 *
 * This exists to settle a disagreement. `proxy.ts` decides "logged in" from the
 * `sid` cookie because that is all it can afford to do on every request;
 * `getServerUser()` decides it by asking Frappe. A cookie whose session has gone
 * — the site was rebuilt, the database restored, the session expired or was
 * logged out elsewhere — is exactly the state where those two answers differ,
 * and without something to break the tie they chase each other:
 *
 *     /os          → cookie passes the proxy → renders → Frappe says Guest
 *                  → redirect to /auth/login
 *     /auth/login  → cookie passes the proxy → redirect to /os
 *
 * Each lap issues every server fetch on the page (nine, on the dashboard) and
 * every one of them comes back 403, which in the bench log reads as
 * `Function ... is not whitelisted` — a message about whitelisting that has
 * nothing to do with whitelisting.
 *
 * A Server Component cannot clear a cookie during render, which is why this is a
 * route handler rather than a few lines in the layout. `proxy.ts` does not match
 * this path, so it cannot bounce the redirect back.
 */

// Everything Frappe sets on a successful login. `sid` is the one that matters —
// it is what the proxy reads — but leaving the others behind would keep showing
// a stale name on the login screen.
const SESSION_COOKIES = ["sid", "user_id", "full_name", "system_user", "user_lang", "user_image"];

export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") || "/os";

  const login = new URL("/auth/login", request.url);
  // Only a path, never an absolute URL: `next` comes from the query string, and
  // redirecting to whatever it says would let a crafted link bounce someone off
  // this origin with the login form as the pretext.
  login.searchParams.set("next", next.startsWith("/") ? next : "/os");

  const response = NextResponse.redirect(login);
  for (const name of SESSION_COOKIES) {
    response.cookies.delete(name);
  }
  return response;
}
