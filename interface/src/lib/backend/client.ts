import "server-only";
import { env } from "@/lib/env";

/**
 * The only module in the app that knows the backend exists.
 *
 * Every call to os.alaiy.com originates here, on the Next.js server. The browser
 * talks to same-origin Server Actions and Route Handlers, which call into this
 * client — so there is no cross-origin request to configure CORS for, and no
 * backend credential ever reaches the client bundle.
 */

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Query string values; undefined/null entries are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /**
   * The end user's ERPNext session. When present the call runs as that user, so
   * ERPNext's own permissions enforce workspace isolation on top of ours.
   */
  userToken?: string;
  /** Next.js fetch cache options. Defaults to no-store — this is live data. */
  cache?: RequestCache;
  revalidate?: number;
  tags?: string[];
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, env.backendUrl);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function authHeader(userToken?: string): Record<string, string> {
  // A user token is a Frappe api_key:api_secret pair, which Frappe reads from
  // the `token` scheme. Bearer is for OAuth2 access tokens and is not what the
  // backend issues.
  if (userToken) return { Authorization: `token ${userToken}` };
  const { backendApiKey, backendApiSecret } = env;
  if (backendApiKey && backendApiSecret) {
    return { Authorization: `token ${backendApiKey}:${backendApiSecret}` };
  }
  return {};
}

export async function backendRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", query, body, userToken, cache, revalidate, tags } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.backendTimeoutMs);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...authHeader(userToken),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: cache ?? (revalidate === undefined ? "no-store" : undefined),
      next: revalidate !== undefined || tags ? { revalidate, tags } : undefined,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new BackendError(
      aborted
        ? `Backend timed out after ${env.backendTimeoutMs}ms`
        : `Could not reach the backend: ${(error as Error).message}`,
      aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  const payload = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const message = extractMessage(payload) ?? `Backend responded ${response.status}`;
    // Server-side only. The user gets a sanitised message; this is what makes
    // the failure diagnosable at all.
    console.error(
      `[backend] ${method} ${path} -> ${response.status}: ${message}`,
    );
    throw new BackendError(message, response.status, payload);
  }

  // ERPNext wraps whitelisted method results in `{ message: ... }`.
  return unwrap<T>(payload);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "message" in payload) {
    return (payload as { message: T }).message;
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/**
 * Frappe puts the human-readable error in `_server_messages`, which is a JSON
 * *string* holding an array of JSON *strings*, each an object with a `message`.
 * Miss that and every backend error collapses into a generic fallback — which
 * is exactly how a missing outgoing Email Account showed up in the UI as
 * "Try again", advice that could never have worked.
 */
function frappeServerMessages(record: Record<string, unknown>): string | undefined {
  const raw = record["_server_messages"];
  if (typeof raw !== "string") return undefined;

  try {
    const entries = JSON.parse(raw) as unknown[];
    const messages = entries
      .map((entry) => {
        if (typeof entry !== "string") return undefined;
        try {
          const parsed = JSON.parse(entry) as { message?: unknown };
          return typeof parsed.message === "string" ? parsed.message : undefined;
        } catch {
          return entry;
        }
      })
      .filter((m): m is string => Boolean(m))
      // Frappe messages may carry markup and HTML entities.
      .map((m) => m.replace(/<[^>]*>/g, "").replace(/&gt;/g, ">").replace(/&lt;/g, "<").trim());

    return messages.length ? messages.join(" ") : undefined;
  } catch {
    return undefined;
  }
}

function extractMessage(payload: unknown): string | undefined {
  if (typeof payload === "string") return payload || undefined;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    const serverMessage = frappeServerMessages(record);
    if (serverMessage) return serverMessage;

    for (const key of ["message", "exception", "_error_message", "error", "exc_type"]) {
      const value = record[key];
      if (typeof value === "string" && value) return value;
    }
  }
  return undefined;
}

export const backend = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    backendRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    backendRequest<T>(path, { ...options, method: "POST", body }),
};
