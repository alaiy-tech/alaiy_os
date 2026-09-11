import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decrypt, effectiveStep } from "@/lib/auth/session";
import { DEMO_LANDING, DEMO_MODE } from "@/lib/dev/demo";

/**
 * Optimistic route protection (Next.js 16 renamed `middleware` to `proxy`).
 *
 * This only reads the signed cookie to decide where to send someone — it is a
 * redirect optimisation, not the authorisation boundary. Every page and Server
 * Action re-verifies through the DAL in src/lib/auth/dal.ts.
 */

function isPublic(pathname: string): boolean {
  // Route Handlers authenticate themselves and answer with their own status
  // codes. Redirecting them here would hand a polling fetch() an HTML page
  // instead of the 401 it can act on.
  //
  // /changelog is public because it is about the product, not about a seller's
  // data. It is also the one public page a signed-in seller is left on rather
  // than redirected away from — sending someone reading release notes to /home
  // would be a bug, not a convenience.
  return (
    pathname === "/" ||
    pathname === "/start" ||
    pathname === "/changelog" ||
    pathname.startsWith("/api/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Demo mode. Nothing is protected because nothing has been signed into, and
  // the two routes whose whole job is to get someone signed in — the marketing
  // page and /start — have nothing to show, so both land on the Dashboard.
  if (DEMO_MODE) {
    if (pathname === "/" || pathname === "/start") {
      return NextResponse.redirect(new URL(DEMO_LANDING, request.url));
    }
    return NextResponse.next();
  }

  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic(pathname)) {
    const signIn = new URL("/start", request.url);
    // Come back here once they are through auth.
    if (pathname !== "/") signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (session && (pathname === "/" || pathname === "/start")) {
    // A seller part-way through onboarding belongs on /start — that is where
    // the steps are — so only a finished one is sent to the app. Bouncing them
    // off /start the way this used to would now bounce them out of onboarding.
    const step = effectiveStep(session.onboardingStep);
    if (step === "done") {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/start", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)"],
};
