import { redirect } from "next/navigation";

import { getFrappeUrl } from "@/lib/frappe/config";

/** "Print" hands the order to Frappe's own print view, which is where the
 * site's letterhead and its chosen Print Format already live — rebuilding
 * either here would produce a second document that looks nothing like the one
 * the business actually sends out.
 *
 * A route handler for the same reason as /os/sales/orders/new: the bench URL
 * is server-only config, so resolving it here keeps the Frappe origin out of
 * the client bundle. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const query = new URLSearchParams({
    doctype: "Sales Order",
    name: decodeURIComponent(id),
    trigger_print: "1",
  });

  redirect(`${getFrappeUrl()}/printview?${query.toString()}`);
}
