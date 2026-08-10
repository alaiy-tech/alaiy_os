import type { NextRequest } from "next/server";

import { proxyToFrappe } from "@/lib/frappe/proxy.server";

// Proxies /api/resource/<doctype>[/<name>] to Frappe's REST document API,
// e.g. /api/resource/Sales Order, /api/resource/Item/ITEM-0001.
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToFrappe(req, `/api/resource/${path.join("/")}`);
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
