import "server-only";

/**
 * Server-only environment access.
 *
 * Importing this module from a Client Component is a build error (`server-only`),
 * which is the guardrail that keeps the backend URL and every credential out of
 * the browser bundle.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  /** ERPNext backend. Read only on the server — never shipped to the client. */
  get backendUrl() {
    return required("ALAIY_BACKEND_URL").replace(/\/$/, "");
  },
  get backendApiKey() {
    return optional("ALAIY_BACKEND_API_KEY");
  },
  get backendApiSecret() {
    return optional("ALAIY_BACKEND_API_SECRET");
  },
  get backendTimeoutMs() {
    return Number(optional("ALAIY_BACKEND_TIMEOUT_MS", "15000"));
  },

  /** Public origin of this app, used to build OAuth redirect URIs. */
  get appUrl() {
    return required("APP_URL").replace(/\/$/, "");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },

  get google() {
    return {
      clientId: required("GOOGLE_CLIENT_ID"),
      clientSecret: required("GOOGLE_CLIENT_SECRET"),
    };
  },
} as const;

/**
 * True when Google SSO is configured, so the sign-in page can hide a button
 * that cannot work.
 *
 * Shopify and Amazon are deliberately absent: their credentials live on the
 * ERPNext bench, not here, and the connector reports its own readiness.
 */
export function isConfigured(provider: "google"): boolean {
  const keys = {
    google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  }[provider];
  return keys.every((key) => Boolean(process.env[key]));
}
