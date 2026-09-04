// Client-side: the field writes on the Item detail page. Through this app's
// /api/method proxy rather than straight to Frappe, which is what attaches the
// CSRF token every write needs (see lib/frappe/proxy.server.ts).

import { frappeErrorMessage } from "@/lib/frappe/error-message";
import type { ItemDetailHeader } from "@/types/products";

export class ItemApiError extends Error {}

/** What one Item field can be set to from the page. Booleans are the Check
 * fields, which Frappe stores as 0/1 — the coercion happens server-side, where
 * the fieldtype is known, rather than being guessed here. */
export type ItemFieldValue = string | number | boolean | null;

/**
 * Write one or more Item fields and hand back the item as it was stored.
 *
 * The response is the saved row, not an acknowledgement, because ERPNext's Item
 * controller can normalise what it was given — so the page redraws from what is
 * now in the database rather than from what it just sent.
 *
 * Which fields may be written is decided by the allowlist in
 * alaiy_os/api/item.py, not here: a client-side list would be a suggestion.
 */
export async function updateItem(name: string, values: Record<string, ItemFieldValue>): Promise<ItemDetailHeader> {
  const res = await fetch("/api/method/alaiy_os.api.item.update_item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, values }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: ItemDetailHeader;
    exception?: string;
    exc_type?: string;
    _server_messages?: string;
  };

  if (!res.ok) throw new ItemApiError(frappeErrorMessage(body, `Could not save (${res.status}).`));
  if (!body.message) throw new ItemApiError("Frappe saved the item but returned nothing to redraw from.");

  return body.message;
}
