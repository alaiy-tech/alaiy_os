// Client-side: the docstatus actions on the Sales Order detail page. These go
// through this app's /api/method proxy rather than to Frappe directly, which
// is what attaches the CSRF token every write needs (see lib/frappe/proxy.server.ts).

export type ActionResult = { name: string; status?: string; docstatus?: number };

export type CreatedDocument = { name: string; doctype: string };

/** Frappe reports a refused or failed write as a non-2xx carrying either a
 * `_server_messages` array (the user-facing `frappe.throw` text, JSON-encoded
 * twice) or an `exception` string. Both are unpacked here so the toast can say
 * what actually went wrong — "Link Exists: Delivery Note MAT-DN-0001" is the
 * whole answer to a refused cancel, and a generic failure message would hide it. */
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

  if (!res.ok) throw new Error(frappeErrorMessage(body) ?? `Request failed (${res.status})`);
  if (!body.message) throw new Error("Frappe returned no result.");

  return body.message;
}

function frappeErrorMessage(body: { exception?: string; _server_messages?: string }): string | null {
  if (body._server_messages) {
    try {
      const messages = JSON.parse(body._server_messages) as string[];
      const parsed = messages.map((entry) => {
        const inner = JSON.parse(entry) as { message?: string };
        return inner.message ?? entry;
      });
      // Frappe's messages carry markup (<b>, <br>) that a toast renders literally.
      const text = parsed
        .join(" ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) return text;
    } catch {
      // Fall through to `exception` below rather than surfacing a parse error.
    }
  }

  // "frappe.exceptions.LinkExistsError: ..." — the class path is noise here.
  if (body.exception) return body.exception.replace(/^[\w.]*Error:\s*/, "").trim() || null;

  return null;
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
