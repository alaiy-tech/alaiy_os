import "server-only";
import { createSession, type OnboardingStep } from "@/lib/auth/session";
import type { AuthResult } from "@/lib/backend/types";

/**
 * Turns a backend auth result into a signed session cookie, and works out which
 * onboarding step the user still owes us.
 *
 * `profileFromSso` is true for Google — SSO already gave us name and photo, so
 * step 2 of the spec's flow is skipped entirely.
 */
export async function establishSession(
  result: AuthResult,
  { profileFromSso = false }: { profileFromSso?: boolean } = {},
): Promise<OnboardingStep> {
  const { user, workspace, token } = result;

  // Completion is a fact about the account, so it is read from the workspace
  // rather than recomputed. Without this first branch a returning seller is
  // sent back through connecting their channels and a second import, however
  // many times they have finished it.
  const onboardingStep: OnboardingStep = workspace.onboarding_complete
    ? "done"
    : workspace.profile_complete || profileFromSso
      ? "connect"
      : "profile";

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    photoUrl: user.photo_url,
    workspaceId: workspace.id,
    tier: workspace.tier ?? "free",
    onboardingStep,
    skipProfile: profileFromSso,
    backendToken: token,
  });

  return onboardingStep;
}
