import type { NextRequest } from "next/server";

import { proxyToFrappe } from "@/lib/frappe/proxy.server";

// Proxies /api/method/<dotted.method.path> to Frappe's whitelisted-method API,
// e.g. /api/method/login, /api/method/logout, /api/method/frappe.auth.get_logged_user.
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToFrappe(req, `/api/method/${path.join("/")}`);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
