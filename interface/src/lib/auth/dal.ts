import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  decrypt,
  effectiveStep,
  type SessionPayload,
} from "@/lib/auth/session";
import { DEMO_MODE, DEMO_SESSION } from "@/lib/dev/demo";

/**
 * Data Access Layer.
 *
 * Every server-rendered page and Server Action reads auth through here rather
 * than trusting the proxy's optimistic check. `cache` dedupes the verification
 * within a single render pass.
 */

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const session = await decrypt(store.get(SESSION_COOKIE)?.value);
  if (session) return session;
  // Demo mode, and only in a dev build: everything above this layer — the
  // pages, the layouts, the Server Actions and the Route Handlers — goes on
  // believing it is reading a cookie. A real cookie still wins, so signing in
  // for real with the flag on behaves normally.
  return DEMO_MODE ? DEMO_SESSION : null;
});

/** Redirects to sign-in when there is no valid session. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/start");
  return session;
}

/**
 * For pages behind onboarding. Sends a half-onboarded user back to the step
 * they still owe us, so nobody can deep-link past channel connection.
 */
export async function requireOnboardedSession(): Promise<SessionPayload> {
  const session = await requireSession();
  const step = effectiveStep(session.onboardingStep);
  if (step !== "done") {
    // /start is the whole of getting started now: it works out which step is
    // still owed and renders it beside the masthead.
    redirect("/start");
  }
  return session;
}
