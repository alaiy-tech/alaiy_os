import { type NextRequest, NextResponse } from "next/server";

// Frappe sets a `sid` cookie of literal value "Guest" for unauthenticated
// sessions, so presence alone doesn't mean logged-in — the value must be
// checked too.
function hasFrappeSession(req: NextRequest): boolean {
  const sid = req.cookies.get("sid")?.value;
  return Boolean(sid) && sid !== "Guest";
}

/**
 * Runs before requests complete.
 * Gates the /os dashboard behind a Frappe session, and keeps already-logged-in
 * users out of the login page. This is a redirect-before-render convenience —
 * it doesn't validate the session cookie against Frappe (a stale/invalidated
 * sid still passes this check; the /os layout does the authoritative check
 * via getServerUser(), reading the x-pathname header set below to build the
 * same `next` redirect if that check fails).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // The Headless OS runtime database lives under `public/` (see
  // src/runtime/store/sqlite-page-store.ts) because that's where this
  // phase's local config store was asked to live - but anything under
  // `public/` is otherwise served as a static file by Next.js regardless of
  // auth state. This is the concrete mechanism that stops that: a bare 404
  // for this exact path, checked before anything else, so the browser can
  // never download the database file.
  if (pathname === "/headless-os.sqlite") {
    return new NextResponse(null, { status: 404 });
  }

  const loggedIn = hasFrappeSession(req);
  const isGatedRoute = pathname.startsWith("/os") || pathname.startsWith("/settings");

  if (!loggedIn && isGatedRoute) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (loggedIn && pathname.startsWith("/auth/login")) {
    return NextResponse.redirect(new URL("/os", req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname + search);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/os/:path*", "/settings/:path*", "/auth/login", "/headless-os.sqlite"],
};
