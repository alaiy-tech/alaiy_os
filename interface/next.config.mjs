/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // A composed deployment runs `.next/standalone/server.js` under PM2, and the
  // workspace it is built from is a throwaway directory — so the server has to
  // carry its own traced node_modules rather than depend on that directory
  // surviving. No effect on `next dev`.
  output: "standalone",
  allowedDevOrigins: ["100.125.212.31", "localhost"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async rewrites() {
    // The Frappe proxy handlers and the /auth/expired route handler live
    // under src/app/api/frappe/proxy/** and src/app/api/auth/expired -
    // nested for organization - but must keep answering their original
    // public URLs (Frappe's own API shape for the proxies; the pre-existing
    // /auth/expired address every caller in this repo already targets).
    // Rewrites are transparent to the caller, unlike redirects: the browser
    // (and every existing `fetch("/api/method/...")` call in src/lib/frappe/)
    // never sees the nested path.
    //
    // Frappe's own site-wide static assets (not a File doctype attachment,
    // so the /files/* proxy above doesn't cover it) - e.g. the org's
    // uploaded logo, copied by OS Theme Settings to a fixed filename under
    // sites/assets/images/ (see lib/frappe/server.ts's getOrganisationLogoSrc).
    // Same-origin from the browser's view, so next/image needs no
    // `images.remotePatterns` entry for the bench's own host, and no CORS/
    // cookie concerns either - a plain external rewrite, same idea as the
    // proxies above, just to a literal external destination instead of an
    // internal route handler.
    const frappeUrl = (process.env.FRAPPE_URL ?? "").replace(/\/+$/, "");

    return [
      { source: "/api/method/:path*", destination: "/api/frappe/proxy/api/method/:path*" },
      { source: "/api/resource/:path*", destination: "/api/frappe/proxy/api/resource/:path*" },
      { source: "/files/:path*", destination: "/api/frappe/proxy/files/:path*" },
      { source: "/private/files/:path*", destination: "/api/frappe/proxy/private/files/:path*" },
      { source: "/auth/expired", destination: "/api/auth/expired" },
      ...(frappeUrl ? [{ source: "/frappe-assets/:path*", destination: `${frappeUrl}/assets/:path*` }] : []),
    ];
  },
  async redirects() {
    return [
      // Bare /os is a real page now (src/app/(platform)/os/page.tsx) — no
      // redirect needed, and one here would make that page unreachable
      // (redirects() is checked before filesystem routing).

      // Settings has no index page of its own — land on the first item.
      {
        source: "/settings",
        destination: "/settings/organisation",
        permanent: false,
      },
      // Sales Orders moved under /os/sales/ — keep old bookmarks working.
      {
        source: "/os/sales-orders",
        destination: "/os/sales/orders",
        permanent: false,
      },
      // Same for Purchase Orders, now under /os/procurement/.
      {
        source: "/os/purchase-orders",
        destination: "/os/procurement/purchase-orders",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
