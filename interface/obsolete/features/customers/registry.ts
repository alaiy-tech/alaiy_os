import { CustomerTrend } from "@/app/(main)/os/customers/_components/customer-trend";
import {
  baseComponentRegistry,
  type ComponentRegistry,
  mergeRegistries,
} from "@/ui-runtime/registry/component-registry";

import { CustomersTable } from "./customers-table";

/**
 * Customers' own registry: the shared base entries merged with the two
 * components that don't generalize - `CustomerTrend` (a Bar+Line
 * new-vs-active-customers chart, structurally different from the
 * dashboard's Bar+Area revenue/profit chart) and `os-data-table` (its own
 * statically-imported columns - see `component-registry.ts`'s comment on why
 * that type isn't in the base registry). No customers-specific filter-bar
 * type is needed: `/os/customers` only ever shows a plain period toggle,
 * which the shared `os-period-toggle` base entry already covers.
 */
export const customersComponentRegistry: ComponentRegistry = mergeRegistries(baseComponentRegistry, {
  "os-customer-trend": {
    type: "os-customer-trend",
    component: CustomerTrend,
    description: "New customers vs. those who placed an order, by month over the last 12 months.",
  },
  "os-data-table": {
    type: "os-data-table",
    component: CustomersTable,
    description: "Customer roster: searchable, filterable, sortable, with column visibility and selection.",
  },
});
