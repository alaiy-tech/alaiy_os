import type { ItemAttributeRow, ItemAttributeValue } from "@/types/item-attributes";

const BASE = "/api/method/alaiy_os.api.item_attribute";

export class ItemAttributeApiError extends Error {}

/** Pull a readable sentence out of a Frappe error body.
 *
 * The useful text is usually in `_server_messages`, a JSON-encoded array of
 * JSON-encoded objects, and ERPNext writes those messages as HTML — the
 * attribute-value guards in particular wrap item names in `<b>`. Toasts render
 * as plain text, so the markup is stripped rather than shown raw. */
function extractErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const raw = data._server_messages;
  if (typeof raw === "string") {
    try {
      const messages = JSON.parse(raw) as string[];
      const texts = messages.map((entry) => {
        try {
          return (JSON.parse(entry) as { message?: string }).message ?? entry;
        } catch {
          return entry;
        }
      });
      const text = toPlainText(texts.join(" "));
      if (text) return text;
    } catch {
      // malformed _server_messages — fall through to the plainer fields below
    }
  }

  if (typeof data.message === "string" && data.message) return toPlainText(data.message);
  if (typeof data.exc_type === "string" && data.exc_type) return data.exc_type;
  return fallback;
}

function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function call<T>(method: string, fallback: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}.${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ItemAttributeApiError(extractErrorMessage(data, fallback));
  return data.message as T;
}

export function getItemAttributes(): Promise<ItemAttributeRow[]> {
  return call<ItemAttributeRow[]>("get_attributes", "Could not load item attributes.");
}

export function createItemAttribute(attributeName: string, values: string[]): Promise<string> {
  return call<string>("create_attribute", "Could not create the attribute.", {
    attribute_name: attributeName,
    values,
  });
}

export function deleteItemAttribute(attribute: string): Promise<void> {
  return call<void>("delete_attribute", "Could not delete the attribute.", { attribute });
}

export function addItemAttributeValue(attribute: string, attributeValue: string): Promise<ItemAttributeValue[]> {
  return call<ItemAttributeValue[]>("add_value", "Could not add the value.", {
    attribute,
    attribute_value: attributeValue,
  });
}

export function renameItemAttributeValue(
  attribute: string,
  rowName: string,
  attributeValue: string,
): Promise<ItemAttributeValue[]> {
  return call<ItemAttributeValue[]>("rename_value", "Could not rename the value.", {
    attribute,
    row_name: rowName,
    attribute_value: attributeValue,
  });
}

export function deleteItemAttributeValue(attribute: string, rowName: string): Promise<ItemAttributeValue[]> {
  return call<ItemAttributeValue[]>("delete_value", "Could not delete the value.", {
    attribute,
    row_name: rowName,
  });
}
