export type LinkOption = { name: string };

const PAGE_LENGTH = 20;

/**
 * Documents of any DocType matching a typed term, for rendering a Link field
 * whose target isn't known until runtime — a connector's settings screen, say,
 * where the DocType comes out of that connector's field metadata.
 *
 * Matches on `name` alone. A doctype-specific search should prefer its own
 * helper (see `searchSuppliers`), which can also match the display field that
 * users actually type when `name` is an opaque series code. An empty term
 * returns the first page, so the list has something in it before anyone types.
 */
export async function searchLinkOptions(doctype: string, term: string): Promise<LinkOption[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(["name"]));
  query.set("order_by", "name asc");
  query.set("limit_page_length", String(PAGE_LENGTH));

  const trimmed = term.trim();
  if (trimmed) query.set("filters", JSON.stringify([["name", "like", `%${trimmed}%`]]));

  const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch ${doctype}: ${res.status}`);

  const data = (await res.json()) as { data: LinkOption[] };
  return data.data;
}
