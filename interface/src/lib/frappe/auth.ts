// Thin wrapper around Frappe's own auth endpoints, called through this app's
// /api/method proxy (see src/app/api/method/[...path]/route.ts) so the browser
// only ever talks to this app's origin — Frappe's session cookie gets set on
// that origin, not on Frappe's.
import { type FrappeUser, toFrappeUser, USER_PROFILE_FIELDS, type UserProfileFields } from "./user";

export class FrappeAuthError extends Error {}

export type FrappeLoginResult = {
  message: string;
  full_name?: string;
  home_page?: string;
};

// Frappe reports failures as `{ message, _server_messages }`, where
// _server_messages is itself a JSON-encoded array of JSON-encoded objects.
function extractErrorMessage(data: Record<string, unknown>): string {
  const raw = data._server_messages;
  if (typeof raw === "string") {
    try {
      const [first] = JSON.parse(raw) as string[];
      if (first) {
        try {
          return (JSON.parse(first) as { message?: string }).message ?? first;
        } catch {
          return first;
        }
      }
    } catch {
      // malformed _server_messages, fall through to the default below
    }
  }
  return typeof data.message === "string" ? data.message : "Invalid email or password.";
}

export async function loginWithFrappe(usr: string, pwd: string): Promise<FrappeLoginResult> {
  const res = await fetch("/api/method/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usr, pwd }),
  });

  const data = await res.json().catch(() => ({}) as Record<string, unknown>);

  if (!res.ok) {
    throw new FrappeAuthError(extractErrorMessage(data));
  }

  return data as FrappeLoginResult;
}

export async function logoutFromFrappe(): Promise<void> {
  await fetch("/api/method/logout", { method: "POST" });
}

export async function getLoggedInUser(): Promise<string | null> {
  const res = await fetch("/api/method/frappe.auth.get_logged_user");
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: string };
  return data.message && data.message !== "Guest" ? data.message : null;
}

export async function fetchCurrentUser(): Promise<FrappeUser | null> {
  const userId = await getLoggedInUser();
  if (!userId) return null;

  const fields = encodeURIComponent(JSON.stringify(USER_PROFILE_FIELDS));
  const profileRes = await fetch(`/api/resource/User/${encodeURIComponent(userId)}?fields=${fields}`);
  const profile = profileRes.ok ? ((await profileRes.json()) as { data?: UserProfileFields }).data : undefined;

  return toFrappeUser(userId, profile);
}
