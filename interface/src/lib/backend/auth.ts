import "server-only";
import { backend } from "@/lib/backend/client";
import type { AuthResult } from "@/lib/backend/types";

/**
 * Auth against the Alaiy OS backend. No passwords anywhere in the system —
 * a fresh OTP on every login, or Google SSO.
 */

/** Sends a 6-digit code by email. Returns how long it stays valid. */
export async function requestOtp(email: string): Promise<{ expires_in: number }> {
  return backend.post("/api/method/alaiy_os_self_serve_apis.api.auth.request_otp", {
    email: email.trim().toLowerCase(),
  });
}

/**
 * Verifies the code. On success the backend provisions a workspace (one
 * ERPNext Company) if this is a first sign-in.
 */
export async function verifyOtp(email: string, code: string): Promise<AuthResult> {
  return backend.post("/api/method/alaiy_os_self_serve_apis.api.auth.verify_otp", {
    email: email.trim().toLowerCase(),
    code: code.trim(),
  });
}

/**
 * Exchanges a verified Google identity for an Alaiy session.
 *
 * NOT YET IMPLEMENTED ON THE BACKEND. Google SSO was deferred in favour of
 * shipping the email + OTP path first, so this method does not exist on the
 * connector and the /api/auth/google/* routes will fail until it does. The
 * sign-in page hides the Google button unless GOOGLE_CLIENT_ID is set, so
 * nothing reaches this by accident.
 */
export async function signInWithGoogle(profile: {
  email: string;
  name?: string;
  picture?: string;
  sub: string;
}): Promise<AuthResult> {
  return backend.post("/api/method/alaiy.auth.google_sign_in", {
    email: profile.email.toLowerCase(),
    full_name: profile.name,
    photo_url: profile.picture,
    google_sub: profile.sub,
  });
}
