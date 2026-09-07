import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "alaiy_session";
const SESSION_DURATION_DAYS = 7;

/**
 * Where the user is in the onboarding flow.
 *
 * "channels" and "import" are retained only so a cookie issued before their
 * screens were removed still decodes. Nothing produces either any more —
 * picking channels and connecting them are now one step, and queueing the
 * import is the last thing that step does — and `effectiveStep` maps both onto
 * a route that still exists.
 */
export type OnboardingStep =
  | "profile"
  | "channels"
  | "connect"
  | "import"
  | "done";

/**
 * The step to route on.
 *
 * Two retired steps have to land somewhere. Anyone whose session says "import"
 * had already queued theirs, which is now the definition of finished, so they
 * belong in the app. Anyone sitting on "channels" had not connected anything
 * yet, and channel selection has been folded into Connect, so that is where
 * the rest of their flow now lives.
 *
 * Without this they are redirected to a route that 404s, and the sole way out
 * is to clear the cookie.
 */
export function effectiveStep(step: OnboardingStep): OnboardingStep {
  if (step === "import") return "done";
  if (step === "channels") return "connect";
  return step;
}

export type SessionPayload = {
  userId: string;
  email: string;
  name?: string;
  photoUrl?: string;
  /** ERPNext Company that scopes every query. One per workspace. */
  workspaceId: string;
  tier: "free" | "growth" | "enterprise";
  onboardingStep: OnboardingStep;
  /** True for Google SSO — the profile step is never shown, so the rail hides it. */
  skipProfile: boolean;
  /** Per-user ERPNext token, so backend calls run as the user, not as root. */
  backendToken?: string;
};

const key = new TextEncoder().encode(env.sessionSecret);

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(key);
}

export async function decrypt(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    // Expired or tampered with — treat as signed out.
    return null;
  }
}

/** Writes the session cookie. Only valid inside a Server Action or Route Handler. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encrypt(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

/** Merges changes into the current session — used as onboarding advances. */
export async function updateSession(
  patch: Partial<SessionPayload>,
): Promise<SessionPayload | null> {
  const store = await cookies();
  const current = await decrypt(store.get(SESSION_COOKIE)?.value);
  if (!current) return null;
  const next = { ...current, ...patch };
  await createSession(next);
  return next;
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
