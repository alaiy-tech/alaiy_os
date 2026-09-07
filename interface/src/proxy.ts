import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decrypt, effectiveStep } from "@/lib/auth/session";

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
  return pathname === "/" || pathname === "/start" || pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic(pathname)) {
    const signIn = new URL("/start", request.url);
    // Come back here once they are through auth.
    if (pathname !== "/") signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  if (session && (pathname === "/" || pathname === "/start")) {
    const step = effectiveStep(session.onboardingStep);
    const destination = step === "done" ? "/home" : `/onboarding/${step}`;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)"],
};
