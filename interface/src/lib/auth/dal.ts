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

/**
 * Data Access Layer.
 *
 * Every server-rendered page and Server Action reads auth through here rather
 * than trusting the proxy's optimistic check. `cache` dedupes the verification
 * within a single render pass.
 */

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  return decrypt(store.get(SESSION_COOKIE)?.value);
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
    redirect(`/onboarding/${step}`);
  }
  return session;
}
