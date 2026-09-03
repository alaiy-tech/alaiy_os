import type { NextRequest } from "next/server";

import { proxyToFrappe } from "@/lib/frappe/proxy.server";

// Frappe returns public file URLs (e.g. a User's user_image) as relative
// "/files/..." paths. Proxying the same path here means those URLs just
// work as <img src> without any rewriting on our side.
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToFrappe(req, `/files/${path.join("/")}`);
}

export { handle as GET };
