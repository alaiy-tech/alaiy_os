import type { NextRequest } from "next/server";

import { proxyToFrappe } from "@/lib/frappe/proxy.server";

// Same as src/app/files/[...path]/route.ts but for private files, which
// Frappe only serves to a session with access to the owning document.
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToFrappe(req, `/private/files/${path.join("/")}`);
}

export { handle as GET };
