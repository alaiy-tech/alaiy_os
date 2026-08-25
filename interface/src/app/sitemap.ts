import type { MetadataRoute } from "next";

import { getFrappeUrl } from "@/lib/frappe/config";
import { getPageStore } from "@/runtime/store/sqlite-page-store";

/** The baseline routes - hand-coded pages, not stored in the UI page
 * database, so `getPageStore().listPages()` alone can't see them. Every
 * dynamic page (the dashboard included - it's DB-seeded, route "/os") comes
 * from `listPages()` instead; `/`, `/auth/*` are excluded on purpose (a
 * redirect-only route and session-gated pages have nothing to index). */
const STATIC_ROUTES = [
  "/os/ask-alaiy",
  "/settings/organisation",
  "/settings/users",
  "/settings/permissions",
  "/settings/connectors",
  "/settings/themes",
  "/settings/logs",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getFrappeUrl();
  const dynamicRoutes = (await getPageStore().listPages()).map((page) => page.route);
  const routes = Array.from(new Set([...STATIC_ROUTES, ...dynamicRoutes]));
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified,
    changeFrequency: "weekly",
    priority: route === "/os" ? 1 : 0.7,
  }));
}
