import "server-only";
import { DEMO_MODE } from "@/lib/dev/demo";

/**
 * Server-only environment access.
 *
 * Importing this module from a Client Component is a build error (`server-only`),
 * which is the guardrail that keeps the backend URL and every credential out of
 * the browser bundle.
 */

/**
 * What demo mode stands in for.
 *
 * Three of these are read at module scope — `session.ts` builds its signing key
 * the moment it is imported — so without a fallback the app throws on the first
 * request rather than rendering, and `ALAIY_DEMO=1` alone would not be enough
 * to get a screen up. The backend URL is never dialled in this mode; it is here
 * only so `env.backendUrl` has something to return if something reads it.
 */
const DEMO_FALLBACKS: Record<string, string> = {
  ALAIY_BACKEND_URL: "http://demo.invalid",
  APP_URL: "http://localhost:3000",
  SESSION_SECRET: "alaiy-demo-mode-not-a-real-secret",
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    const fallback = DEMO_MODE ? DEMO_FALLBACKS[name] : undefined;
    if (fallback) return fallback;
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
