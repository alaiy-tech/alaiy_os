// Server-only: for use in Server Components / Server Actions / Route Handlers,
// where we can call Frappe directly instead of looping back through this
// app's own /api/method proxy. Never import this from a "use client" module.
import { cookies } from "next/headers";

import { USER_PROFILE_FIELDS } from "@/constants/frappe-user";
import type { FrappeUser, UserProfileFields } from "@/types/frappe-user";
import type { CompanyInfo, OrganisationLogoSrc } from "@/types/organisation";

import { getFrappeUrl } from "./config";
import { toFrappeUser } from "./user";

export async function frappeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const headers = new Headers(init.headers);
  if (cookieHeader) headers.set("cookie", cookieHeader);

  return fetch(`${getFrappeUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

/**
 * Resolves the current Frappe session (if any) straight from the incoming
 * request's cookies. Returns null for a Guest/absent/invalid session — this
 * is the authoritative check; middleware only checks cookie *presence*.
 */
export async function getServerUser(): Promise<FrappeUser | null> {
  const meRes = await frappeFetch("/api/method/frappe.auth.get_logged_user");
  if (!meRes.ok) return null;

  const me = (await meRes.json()) as { message?: string };
  const userId = me.message;
  if (!userId || userId === "Guest") return null;

  const fields = encodeURIComponent(JSON.stringify(USER_PROFILE_FIELDS));
  const profileRes = await frappeFetch(`/api/resource/User/${encodeURIComponent(userId)}?fields=${fields}`);
  const profile = profileRes.ok ? ((await profileRes.json()) as { data?: UserProfileFields }).data : undefined;

  return toFrappeUser(userId, profile);
}

/** The sidebar shows "{Company} OS" instead of a hardcoded app name, and the
 * default currency prefixes money figures across the OS (KPI cards, table
 * Currency columns - see useCompany()/formatCurrency). Reads the site's
 * default company the same way ERPNext itself resolves it (Global Defaults'
 * default_company), falling back to the oldest Company record if that's
 * unset. Returns null (callers fall back to APP_CONFIG.name / USD) rather
 * than throwing - this is cosmetic, never worth blocking a page over. */
export async function getCompanyInfo(): Promise<CompanyInfo | null> {
  const defaultRes = await frappeFetch(
    "/api/method/frappe.client.get_single_value?doctype=Global+Defaults&field=default_company",
  );
  let companyName: string | null = null;
  if (defaultRes.ok) {
    const data = (await defaultRes.json()) as { message?: string | null };
    companyName = data.message ?? null;
  }

  if (!companyName) {
    const fields = encodeURIComponent(JSON.stringify(["name"]));
    const listRes = await frappeFetch(
      `/api/resource/Company?fields=${fields}&order_by=${encodeURIComponent("creation asc")}&limit_page_length=1`,
    );
    if (!listRes.ok) return null;
    const data = (await listRes.json()) as { data?: Array<{ name: string }> };
    companyName = data.data?.[0]?.name ?? null;
  }
  if (!companyName) return null;

  const fields = encodeURIComponent(JSON.stringify(["default_currency"]));
  const companyRes = await frappeFetch(`/api/resource/Company/${encodeURIComponent(companyName)}?fields=${fields}`);
  const defaultCurrency = companyRes.ok
    ? ((
        (await companyRes.json()) as {
          data?: { default_currency?: string | null };
        }
      ).data?.default_currency ?? null)
    : null;

  return { name: companyName, defaultCurrency };
}

const DEFAULT_SQUARE_LOGO_SRC = "/assets/images/client-logo-square.png";
const DEFAULT_HORIZONTAL_LOGO_SRC = "/assets/images/client-logo-hor.png";

/**
 * Whether the org has uploaded a custom square/horizontal logo (`OS Theme
 * Settings`' own `square_logo`/`horizontal_logo` Attach Image fields,
 * uploaded via `/settings/organisation` - see `lib/frappe/organisation.ts`'s
 * `uploadOrganisationLogo`). If so, the fixed-filename copy that doctype's
 * `on_update` hook already wrote to the bench's shared assets folder
 * (`logo-square.png`/`logo-hor.png`) is what should render - reached
 * same-origin via the `/frappe-assets/*` rewrite (`next.config.mjs`), so
 * neither `next/image` remote-pattern config nor CORS ever comes up.
 * Otherwise, this app's own public-folder default. Used for the favicon
 * (root layout `generateMetadata`) and the app/settings sidebars' logo
 * `<Image>`s. Never throws - cosmetic, not worth blocking a page over.
 */
export async function getOrganisationLogoSrc(): Promise<OrganisationLogoSrc> {
  const [squareRes, horizontalRes] = await Promise.all([
    frappeFetch("/api/method/frappe.client.get_single_value?doctype=OS+Theme+Settings&field=square_logo"),
    frappeFetch("/api/method/frappe.client.get_single_value?doctype=OS+Theme+Settings&field=horizontal_logo"),
  ]);

  const squareUploaded = squareRes.ok && Boolean(((await squareRes.json()) as { message?: string | null }).message);
  const horizontalUploaded =
    horizontalRes.ok && Boolean(((await horizontalRes.json()) as { message?: string | null }).message);

  return {
    square: squareUploaded ? "/frappe-assets/images/logo-square.png" : DEFAULT_SQUARE_LOGO_SRC,
    horizontal: horizontalUploaded ? "/frappe-assets/images/logo-hor.png" : DEFAULT_HORIZONTAL_LOGO_SRC,
  };
}
