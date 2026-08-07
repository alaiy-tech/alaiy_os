import { type NextRequest, NextResponse } from "next/server";

import { getFrappeUrl } from "./config";

// Headers that only make sense between this server and the original client,
// not between this server and the upstream Frappe site.
const EXCLUDED_REQUEST_HEADERS = new Set(["host", "connection", "content-length"]);
const EXCLUDED_RESPONSE_HEADERS = new Set(["content-encoding", "content-length", "transfer-encoding", "connection"]);

// Frappe rejects cookie-session POST/PUT/PATCH/DELETE requests without this
// header. login/logout are exempt: login runs as Guest (no session/token to
// fetch yet), and logout's own CSRF check doesn't gate on it.
const CSRF_EXEMPT_PATHS = new Set(["/api/method/login", "/api/method/logout"]);

async function fetchCsrfToken(cookieHeader: string): Promise<string | null> {
  try {
    const res = await fetch(new URL("/api/method/alaiy_os.api.auth.get_csrf_token", getFrappeUrl()), {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: string };
    return data.message ?? null;
  } catch {
    return null;
  }
}

/**
 * Forwards a request to the Frappe site as-is (method, headers, body, cookies)
 * and streams the response back, forwarding every Set-Cookie header untouched.
 * Frappe's session cookies carry no explicit Domain attribute, so the browser
 * scopes them to whichever origin actually answered the request — this app's
 * origin, not Frappe's — which is what makes the browser-never-talks-to-Frappe
 * (BFF) setup work without any CORS configuration on the Frappe side.
 */
export async function proxyToFrappe(req: NextRequest, frappePath: string): Promise<NextResponse> {
  const target = new URL(frappePath, getFrappeUrl());
  target.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!EXCLUDED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const isMutating = req.method !== "GET" && req.method !== "HEAD";

  if (isMutating && !CSRF_EXEMPT_PATHS.has(frappePath)) {
    const token = await fetchCsrfToken(headers.get("cookie") ?? "");
    if (token) headers.set("X-Frappe-CSRF-Token", token);
  }

  const frappeRes = await fetch(target, {
    method: req.method,
    headers,
    body: isMutating ? await req.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  frappeRes.headers.forEach((value, key) => {
    if (!EXCLUDED_RESPONSE_HEADERS.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      responseHeaders.set(key, value);
    }
  });
  for (const cookie of frappeRes.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new NextResponse(frappeRes.body, {
    status: frappeRes.status,
    headers: responseHeaders,
  });
}
