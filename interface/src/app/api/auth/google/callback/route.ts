import { NextResponse, type NextRequest } from "next/server";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { consumeOAuthState } from "@/lib/auth/oauth-state";
import { establishSession } from "@/lib/auth/establish";
import { signInWithGoogle } from "@/lib/backend/auth";

/**
 * Google redirects here. Everything past this point — the token exchange, the
 * profile read, the call to os.alaiy.com — runs on the server.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const failure = (reason: string) =>
    NextResponse.redirect(new URL(`/start?error=${reason}`, request.url));

  if (params.get("error")) return failure("google_denied");

  const claims = await consumeOAuthState("google", params.get("state"));
  if (!claims) return failure("state_mismatch");

  const code = params.get("code");
  if (!code) return failure("missing_code");

  try {
    const profile = await exchangeGoogleCode(code);
    // Google gives us name and photo, so the profile step is skipped.
    const step = await establishSession(await signInWithGoogle(profile), {
      profileFromSso: true,
    });

    const destination = claims.next || `/onboarding/${step}`;
    return NextResponse.redirect(new URL(destination, request.url));
  } catch (error) {
    console.error("Google sign-in failed", error);
    return failure("google_failed");
  }
}
