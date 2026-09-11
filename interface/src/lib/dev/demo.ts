import type { SessionPayload } from "@/lib/auth/session";

/**
 * Demo mode: the signed-in app, with nobody signed in and no backend behind it.
 *
 * Every screen here is server-rendered from a session cookie and a call to
 * os.alaiy.com, which means a UI change could not be looked at without a Google
 * account, an ERPNext bench and a workspace with orders in it. That is a very
 * long way to go to check a table's spacing. With `ALAIY_DEMO=1` the two things
 * standing between `next dev` and the Dashboard are removed at their single
 * choke points — `getSession` in the DAL, and `backendRequest` in the backend
 * client — so the pages, the layouts and the Server Actions above them are the
 * real ones, unaware they are being fed.
 *
 * ## Why it cannot leak into production
 *
 * Two conditions, and `NODE_ENV` is the one that matters: `next build` inlines
 * it as the literal "production", so the whole of this mode folds away to
 * `false` at build time and a stray `ALAIY_DEMO=1` in a production environment
 * does nothing at all. Flipping it on in a real deployment is not a
 * misconfiguration you can make.
 */
export const DEMO_MODE =
  process.env.NODE_ENV !== "production" && process.env.ALAIY_DEMO === "1";

/**
 * Where demo mode lands.
 *
 * The Dashboard rather than /home, which is the Ask Alaiy conversation: the
 * point of this mode is to look at screens, and the Dashboard is the one with
 * tiles, alerts, a table and the channel strip on it — the densest thing to
 * check a change against, and one click from everything else.
 */
export const DEMO_LANDING = "/dashboard";

/** The ERPNext Company every fabricated row is scoped to. */
export const DEMO_WORKSPACE = "Kavya Home Living";

/**
 * The seller demo mode signs you in as.
 *
 * `onboardingStep: "done"` is what walks past onboarding — `requireOnboardedSession`
 * bounces anything else back to /start, which in this mode has nothing to show.
 * There is deliberately no `backendToken`: nothing reaches a backend to use it,
 * and a fake token that looked real would be a thing to mistake for one.
 */
export const DEMO_SESSION: SessionPayload = {
  userId: "demo-seller",
  email: "demo@alaiy.com",
  name: "Kavya Rao",
  workspaceId: DEMO_WORKSPACE,
  tier: "growth",
  onboardingStep: "done",
  // The profile step is skipped for the same reason Google SSO skips it: this
  // seller's name is already known, so the rail should not offer to collect it.
  skipProfile: true,
};
