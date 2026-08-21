import { readPeriod } from "@/components/derived/list/period";
import { getCustomersServer } from "@/lib/frappe/customer-list.server";
import { getCustomersOverviewServer, getCustomerTrendServer } from "@/lib/frappe/customer-stats.server";
import { getCompanyInfo } from "@/lib/frappe/server";
import type { Customer, CustomerStatus } from "@/types/customers";
import type { PeriodComparison } from "@/types/list";
import type { DataSourceContext } from "@/types/runtime/data-source";

import { registerDataSource } from "../registry";

/** Customer data sources - each `resolve()` calls the existing, unmodified
 * fetchers in `src/lib/frappe/customer-list.server.ts` /
 * `customer-stats.server.ts`. This is the seam `/os/headless/customers`
 * depends on instead of importing a feature-specific fetcher module
 * directly (brief §32's explicit acceptance criterion). */

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function flattenComparison(
  metric: string,
  comparison: PeriodComparison | null | undefined,
  out: Record<string, unknown>,
) {
  if (!comparison) return;
  out[metric] = comparison.current;
  out[`${metric}_delta`] = pctChange(comparison.current, comparison.previous);
}

/** ERPNext has no customer lifecycle field, so status is derived: disabled
 * wins, then whether they have ever placed a submitted order - the same
 * rule `/os/customers`'s own `toCustomerStatus` used. */
function customerStatus(customer: Customer): CustomerStatus {
  if (customer.disabled) return "Disabled";
  return customer.orders > 0 ? "Active" : "No Orders";
}

function toCustomerRow(customer: Customer): Record<string, unknown> {
  return {
    id: customer.name,
    name: customer.customer_name,
    status: customerStatus(customer),
    group: customer.customer_group ?? null,
    territory: customer.territory ?? null,
    orders: customer.orders,
    spend: customer.total_spend,
    lastOrder: customer.last_order_date,
    joined: customer.creation.replace(" ", "T"),
  };
}

registerDataSource({
  id: "customers.overview",
  description: "Headline KPI figures for the customer base: total/new/active customers, revenue per customer.",
  capabilities: {},
  fields: [
    { name: "total_customers", label: "Total Customers", type: "number" },
    { name: "new_customers", label: "New Customers", type: "number" },
    { name: "active_customers", label: "Active Customers", type: "number" },
    {
      name: "revenue_per_customer",
      label: "Revenue per Customer",
      type: "currency",
    },
  ],
  async resolve(context: DataSourceContext) {
    const period = readPeriod(context.searchParams);
    const [overview, company] = await Promise.all([getCustomersOverviewServer(period), getCompanyInfo()]);

    const flat: Record<string, unknown> = {
      period,
      defaultCurrency: company?.defaultCurrency ?? undefined,
    };
    if (overview) {
      flattenComparison("total_customers", overview.total_customers, flat);
      flattenComparison("new_customers", overview.new_customers, flat);
      flattenComparison("active_customers", overview.active_customers, flat);
      flattenComparison("revenue_per_customer", overview.revenue_per_customer, flat);
    }
    return flat;
  },
});

registerDataSource({
  id: "customers.trend",
  description: "New customers vs. those who placed an order, by month over the last 12 months.",
  capabilities: { list: true },
  fields: [
    { name: "period", label: "Period", type: "string" },
    { name: "new_customers", label: "New", type: "number" },
    { name: "active_customers", label: "Ordered", type: "number" },
  ],
  async resolve() {
    return await getCustomerTrendServer();
  },
});

registerDataSource({
  id: "customers",
  description: "The customer roster: name, status, group, territory, orders, spend, last order date, joined date.",
  capabilities: {
    list: true,
    search: true,
    filter: true,
    sort: true,
    pagination: true,
  },
  fields: [
    { name: "name", label: "Customer", type: "string" },
    { name: "status", label: "Status", type: "string" },
    { name: "group", label: "Group", type: "string" },
    { name: "territory", label: "Territory", type: "string" },
    { name: "orders", label: "Orders", type: "number" },
    { name: "spend", label: "Total Spend", type: "currency" },
    { name: "lastOrder", label: "Last Order", type: "date" },
    { name: "joined", label: "Joined", type: "date" },
  ],
  async resolve() {
    const list = await getCustomersServer();
    return (list?.customers ?? []).map(toCustomerRow);
  },
});
