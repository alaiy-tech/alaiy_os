import "server-only";
import { env } from "@/lib/env";
import { redirectUri } from "@/lib/auth/oauth-state";

/** Google SSO. One click, and it hands us name, email and photo. */

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

export function googleAuthorizeUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.google.clientId);
  url.searchParams.set("redirect_uri", redirectUri(GOOGLE_CALLBACK_PATH));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // Always show the chooser rather than silently reusing one account.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

/** Exchanges the code and reads the profile. Runs server-side only. */
export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: redirectUri(GOOGLE_CALLBACK_PATH),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed: ${await tokenResponse.text()}`);
  }

  const { access_token } = (await tokenResponse.json()) as { access_token: string };

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${access_token}` }, cache: "no-store" },
  );

  if (!profileResponse.ok) {
    throw new Error(`Google profile fetch failed: ${await profileResponse.text()}`);
  }

  const profile = (await profileResponse.json()) as GoogleProfile;
  if (!profile.email_verified) {
    throw new Error("Google account has no verified email address");
  }
  return profile;
}
