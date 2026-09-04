export type CustomerOption = { name: string; customer_name: string };

const PAGE_LENGTH = 20;

/** Customers matching a typed term, for the Sales Orders customer filter.
 *
 * Matches on the docname and the display name, because on sites that leave
 * naming by series on, `customer` is an opaque code (CUST-0001) while
 * `customer_name` is what the user is actually typing. An empty term returns
 * the first page unfiltered, so the dropdown has something to show before
 * anyone types. */
export async function searchCustomers(term: string): Promise<CustomerOption[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(["name", "customer_name"]));
  query.set("order_by", "customer_name asc");
  query.set("limit_page_length", String(PAGE_LENGTH));

  const trimmed = term.trim();
  if (trimmed) {
    query.set(
      "or_filters",
      JSON.stringify([
        ["customer_name", "like", `%${trimmed}%`],
        ["name", "like", `%${trimmed}%`],
      ]),
    );
  }

  const res = await fetch(`/api/resource/Customer?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch customers: ${res.status}`);

  const data = (await res.json()) as { data: CustomerOption[] };
  return data.data;
}
