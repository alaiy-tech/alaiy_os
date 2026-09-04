/**
 * Turning a failed Frappe response into a sentence a person can act on.
 *
 * Frappe reports a refused write in one of three places, in descending order of
 * usefulness:
 *
 * - `_server_messages` — the text passed to `frappe.throw`, and the only field
 *   written for a human. It arrives JSON-encoded twice (an array of encoded
 *   objects) and carries HTML, because the desk renders it as markup: ERPNext's
 *   own guards wrap document names in `<b>`.
 * - `exception` — `"frappe.exceptions.LinkExistsError: Cannot delete ..."`. The
 *   class path is noise to a reader, so it is trimmed off the front.
 * - `exc_type` — the class name alone, which at least names the failure.
 *
 * Worth one shared implementation because the alternative is each feature
 * inventing its own and one of them settling for "Request failed (417)", which
 * throws away the only text that said what to do about it.
 */

type FrappeErrorBody = {
  message?: unknown;
  exception?: unknown;
  exc_type?: unknown;
  _server_messages?: unknown;
};

export function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The most specific message the body carries, or `fallback` when it carries
 * none. `message` is only read when it holds a string — on a successful call it
 * is the payload, and on some failures it is an object. */
export function frappeErrorMessage(body: FrappeErrorBody, fallback: string): string {
  if (typeof body._server_messages === "string") {
    try {
      const encoded = JSON.parse(body._server_messages) as string[];
      const texts = encoded.map((entry) => {
        try {
          return (JSON.parse(entry) as { message?: string }).message ?? entry;
        } catch {
          return entry;
        }
      });
      const text = toPlainText(texts.join(" "));
      if (text) return text;
    } catch {
      // Malformed _server_messages — fall through to the plainer fields below
      // rather than surfacing a parse error the user can do nothing with.
    }
  }

  if (typeof body.message === "string" && body.message) return toPlainText(body.message);

  if (typeof body.exception === "string" && body.exception) {
    const trimmed = body.exception.replace(/^[\w.]*Error:\s*/, "").trim();
    if (trimmed) return toPlainText(trimmed);
  }

  if (typeof body.exc_type === "string" && body.exc_type) return body.exc_type;

  return fallback;
}
