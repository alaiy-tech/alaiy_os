import { redirect } from "next/navigation";

import { getFrappeUrl } from "@/lib/frappe/config";

/** Opens a document in the Frappe desk.
 *
 * The Sales Order detail page links out to the Delivery Notes, Sales Invoices
 * and Customers behind an order, and none of those has a native page in this
 * app yet (issues #129, #128 and #114). Sending the user to the desk keeps
 * those rows genuinely clickable in the meantime; each link moves to its own
 * route as that page lands, and this handler goes away once none are left.
 *
 * A route handler rather than a plain link, because the bench URL is
 * server-only config (see lib/frappe/config.ts): resolving it here keeps the
 * Frappe origin out of the client bundle, which is the same reason every data
 * call goes through this app's /api proxy instead of the browser talking to
 * Frappe directly. It is also why the doctype is checked against a list rather
 * than slugged and passed through — the segment comes from the URL, so without
 * this an outside link could point a logged-in user at any form on the bench.
 */
const DESK_SLUG: Record<string, string> = {
  "delivery-note": "delivery-note",
  "sales-invoice": "sales-invoice",
  customer: "customer",
};

export async function GET(_request: Request, { params }: { params: Promise<{ doctype: string; name: string }> }) {
  const { doctype, name } = await params;

  const slug = DESK_SLUG[doctype.toLowerCase()];
  // A plain 404 rather than notFound(): this is a redirector, not a page, and
  // there is no UI to render into. Nothing in the app links here with an
  // unlisted doctype, so this is only ever reached by a hand-edited URL.
  if (!slug) return new Response("Not found", { status: 404 });

  redirect(`${getFrappeUrl()}/app/${slug}/${encodeURIComponent(decodeURIComponent(name))}`);
}
