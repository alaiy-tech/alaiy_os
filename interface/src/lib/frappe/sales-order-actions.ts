// Client-side: the docstatus actions on the Sales Order detail page. These go
// through this app's /api/method proxy rather than to Frappe directly, which
// is what attaches the CSRF token every write needs (see lib/frappe/proxy.server.ts).

import { frappeErrorMessage } from "@/lib/frappe/error-message";

export type ActionResult = { name: string; status?: string; docstatus?: number };

export type CreatedDocument = { name: string; doctype: string };

/** Frappe reports a refused or failed write as a non-2xx whose body carries the
 * reason — unpacked by frappeErrorMessage so the toast can say what actually
 * went wrong. "Link Exists: Delivery Note MAT-DN-0001" is the whole answer to a
 * refused cancel, and a generic failure message would hide it. */
async function post<T>(method: string, name: string): Promise<T> {
  const res = await fetch(`/api/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: T;
    exception?: string;
    _server_messages?: string;
  };

  if (!res.ok) throw new Error(frappeErrorMessage(body, `Request failed (${res.status})`));
  if (!body.message) throw new Error("Frappe returned no result.");

  return body.message;
}

export function submitSalesOrder(name: string): Promise<ActionResult> {
  return post<ActionResult>("alaiy_os.api.sales_order.submit_sales_order", name);
}

export function cancelSalesOrder(name: string): Promise<ActionResult> {
  return post<ActionResult>("alaiy_os.api.sales_order.cancel_sales_order", name);
}

export function amendSalesOrder(name: string): Promise<ActionResult> {
  return post<ActionResult>("alaiy_os.api.sales_order.amend_sales_order", name);
}

export function makeDeliveryNote(name: string): Promise<CreatedDocument> {
  return post<CreatedDocument>("alaiy_os.api.sales_order.make_delivery_note_from_order", name);
}

export function makeSalesInvoice(name: string): Promise<CreatedDocument> {
  return post<CreatedDocument>("alaiy_os.api.sales_order.make_sales_invoice_from_order", name);
}
