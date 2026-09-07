import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * CSRF protection for every OAuth round trip.
 *
 * The `state` parameter is a short-lived signed JWT, and the same nonce is
 * mirrored into an httpOnly cookie. A callback is only honoured when the two
 * agree, so a forged callback URL cannot attach someone else's store to a
 * workspace.
 */

const STATE_TTL = "10m";
const key = new TextEncoder().encode(env.sessionSecret);

export type OAuthStateClaims = {
  nonce: string;
  /** Where to send the user after the callback resolves. */
  next: string;
  /** Provider-specific extras, e.g. the Shopify shop domain. */
  [key: string]: string;
};

function cookieName(provider: string): string {
  return `alaiy_oauth_${provider}`;
}

/** Signs the state and stores its nonce in a cookie. Returns the state string. */
export async function issueOAuthState(
  provider: string,
  claims: Omit<OAuthStateClaims, "nonce">,
): Promise<string> {
  const nonce = crypto.randomUUID();
  const state = await new SignJWT({ ...claims, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(key);

  const store = await cookies();
  store.set(cookieName(provider), nonce, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return state;
}

/** Verifies signature, expiry, and the cookie nonce. Null when any check fails. */
export async function consumeOAuthState(
  provider: string,
  state: string | null,
): Promise<OAuthStateClaims | null> {
  if (!state) return null;

  const store = await cookies();
  const expectedNonce = store.get(cookieName(provider))?.value;
  store.delete(cookieName(provider));
  if (!expectedNonce) return null;

  try {
    const { payload } = await jwtVerify(state, key, { algorithms: ["HS256"] });
    const claims = payload as unknown as OAuthStateClaims;
    return claims.nonce === expectedNonce ? claims : null;
  } catch {
    return null;
  }
}

export function redirectUri(path: string): string {
  return `${env.appUrl}${path}`;
}
