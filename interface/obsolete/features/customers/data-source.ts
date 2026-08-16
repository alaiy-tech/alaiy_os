import type { Period } from "@/components/list/period";
import type { Customer, CustomersOverview, CustomerTrendPoint } from "@/types/customers";

import { toCustomerRow } from "./customers-columns";
import { type CustomerKpiMetric, computeCustomerKpi, type ResolvedCustomerKpi } from "./kpi-source";

export type CustomersRawData = {
  overview: CustomersOverview | null;
  trend: CustomerTrendPoint[];
  customers: Customer[];
  total: number;
  period: Period;
  defaultCurrency?: string;
};

const CUSTOMER_KPI_METRICS: CustomerKpiMetric[] = [
  "total_customers",
  "new_customers",
  "active_customers",
  "revenue_per_customer",
];

/**
 * Shapes `/os/headless/customers`'s raw fetch results into named
 * `DataSource`s, exactly the same role `features/dashboard/data-source.ts`
 * plays for the dashboard - proof the same mechanism generalizes across
 * pages with genuinely different data shapes.
 */
export function buildCustomersDataSources(raw: CustomersRawData): Record<string, unknown> {
  const kpis: Record<CustomerKpiMetric, ResolvedCustomerKpi> = Object.fromEntries(
    CUSTOMER_KPI_METRICS.map((metric) => [
      metric,
      computeCustomerKpi(metric, raw.overview, raw.period, raw.defaultCurrency),
    ]),
  ) as Record<CustomerKpiMetric, ResolvedCustomerKpi>;

  const loaded = raw.customers.length;

  return {
    trend: { points: raw.trend },
    customers: raw.customers.map((customer) => toCustomerRow(customer, raw.defaultCurrency)),
    total: raw.total,
    rosterTitle: `${raw.total.toLocaleString()} ${raw.total === 1 ? "Customer" : "Customers"}`,
    rosterSubtitle:
      loaded < raw.total
        ? `Showing the ${loaded.toLocaleString()} most recently created.`
        : "Group, territory, order history and signup date for every customer.",
    period: raw.period,
    defaultCurrency: raw.defaultCurrency,
    kpis,
  };
}
