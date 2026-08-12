import { redirect } from "next/navigation";

import { getFrappeUrl } from "@/lib/frappe/config";

/** "New PO" sends the user to ERPNext's own Purchase Order form until a
 * native create flow exists.
 *
 * A route handler rather than a plain link, because the bench URL is
 * server-only config (see lib/frappe/config.ts): resolving it here keeps the
 * Frappe origin out of the client bundle, which is the same reason every data
 * call goes through this app's /api proxy instead of the browser talking to
 * Frappe directly.
 *
 * This sits at /new, which would otherwise be a Purchase Order named "new" in
 * the sibling [id] route — a static segment wins over a dynamic one in Next's
 * router, and Frappe docnames are series-generated (PUR-ORD-...), so nothing
 * real is shadowed. */
export function GET() {
  redirect(`${getFrappeUrl()}/app/purchase-order/new`);
}
