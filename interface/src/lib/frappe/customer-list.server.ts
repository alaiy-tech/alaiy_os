// Server-only counterpart to customer-list.ts. That module's searchCustomers
// is a browser fetch behind the Sales Orders filter dropdown and returns bare
// Link options; this one resolves the Customers page's table rows - the
// Customer record plus its Sales Order aggregates - server-side.
import type { CustomerListResult } from "@/types/customers";

import { frappeFetch } from "./server";

export async function getCustomersServer(limit?: number): Promise<CustomerListResult | null> {
  const query = limit ? `?limit=${limit}` : "";
  const res = await frappeFetch(`/api/method/alaiy_os.api.customer.get_customers${query}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: CustomerListResult };
  return data.message ?? null;
}
