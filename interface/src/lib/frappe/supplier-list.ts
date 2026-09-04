export type SupplierOption = { name: string; supplier_name: string };

const PAGE_LENGTH = 20;

/** Suppliers matching a typed term, for the Purchase Orders supplier filter.
 *
 * Matches on the docname and the display name, because on sites that leave
 * naming by series on, `supplier` is an opaque code (SUP-0001) while
 * `supplier_name` is what the user is actually typing. An empty term returns
 * the first page unfiltered, so the dropdown has something to show before
 * anyone types. */
export async function searchSuppliers(term: string): Promise<SupplierOption[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(["name", "supplier_name"]));
  query.set("order_by", "supplier_name asc");
  query.set("limit_page_length", String(PAGE_LENGTH));

  const trimmed = term.trim();
  if (trimmed) {
    query.set(
      "or_filters",
      JSON.stringify([
        ["supplier_name", "like", `%${trimmed}%`],
        ["name", "like", `%${trimmed}%`],
      ]),
    );
  }

  const res = await fetch(`/api/resource/Supplier?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch suppliers: ${res.status}`);

  const data = (await res.json()) as { data: SupplierOption[] };
  return data.data;
}
