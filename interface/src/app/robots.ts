import type { MetadataRoute } from "next";

import { getFrappeUrl } from "@/lib/frappe/config";

/** `/robots.txt` - `/auth/*` (login/session-expired) and `/api/*` (the
 * Frappe proxy routes) are the only paths with no reason to ever be
 * indexed; everything else (`/os/*`, `/settings/*`) is a real page. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/", "/api/"],
    },
    sitemap: `${getFrappeUrl()}/sitemap.xml`,
  };
}
