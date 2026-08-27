import { readPeriod } from "@/components/derived/list/period";
import { getItemsServer } from "@/lib/frappe/item-list.server";
import { getProductsOverviewServer } from "@/lib/frappe/item-stats.server";
import { getCompanyInfo } from "@/lib/frappe/server";
import type { PeriodComparison } from "@/types/list";
import type { ItemListFields, ProductStatus } from "@/types/products";
import type { DataSourceContext } from "@/types/runtime/data-source";

import { registerDataSource } from "../registry";

/** Product data sources - the seam the `products` page definition
 * (`seeds/pages/products-page.ts`) binds to, in place of the removed
 * `/os/products` page's own fetchers. Each `resolve()` calls a
 * `src/lib/frappe/*.server.ts` fetcher; the definition itself never names a
 * Frappe method path.
 *
 * Disclosed simplifications against the old page (all of them capabilities of
 * a bespoke, client-side list that the declarative `os-data-table` contract
 * doesn't cover today): no server-side search/filter/sort - the table filters
 * whatever this returns, in the browser - no per-user saved column
 * preferences, no grid view, no variant child rows, and no derived stock
 * state (that needed a per-item Bin query the list endpoint doesn't do).
 */

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

/** Derived, not a real Item field - disabled/has_variants/variant_of in that
 * priority order, the same rule the old page's `getProductStatus` applied. */
function productStatus(item: ItemListFields): ProductStatus {
  if (item.disabled) return "Disabled";
  if (item.has_variants) return "Template";
  if (item.variant_of) return "Variant";
  return "Active";
}

function toProductRow(item: ItemListFields): Record<string, unknown> {
  return {
    id: item.name,
    code: item.item_code,
    name: item.item_name,
    status: productStatus(item),
    group: item.item_group ?? null,
    uom: item.stock_uom ?? null,
    rate: item.standard_rate ?? 0,
    created: item.creation.replace(" ", "T"),
  };
}

registerDataSource({
  id: "products.overview",
  description:
    "Headline KPI figures for the product catalogue: units sold, on-hand units, average unit value, active SKUs.",
  capabilities: {},
  fields: [
    { name: "units_sold", label: "Total Units Sold", type: "number" },
    { name: "on_hand_units", label: "On-Hand Units", type: "number" },
    { name: "average_unit_value", label: "Average Unit Value", type: "currency" },
    { name: "active_skus", label: "Active SKUs", type: "number" },
  ],
  async resolve(context: DataSourceContext) {
    const period = readPeriod(context.searchParams);
    const [overview, company] = await Promise.all([getProductsOverviewServer(period), getCompanyInfo()]);

    const flat: Record<string, unknown> = {
      period,
      defaultCurrency: company?.defaultCurrency ?? undefined,
    };
    if (overview) {
      flattenComparison("units_sold", overview.units_sold, flat);
      flattenComparison("on_hand_units", overview.on_hand_units, flat);
      flattenComparison("average_unit_value", overview.average_unit_value, flat);
      flattenComparison("active_skus", overview.active_skus, flat);
    }
    return flat;
  },
});

registerDataSource({
  id: "products",
  description:
    "The product catalogue: item code, name, derived status, item group, stock UOM, standard rate, created date.",
  capabilities: {
    list: true,
    search: true,
    filter: true,
    sort: true,
    pagination: true,
  },
  fields: [
    { name: "code", label: "Item Code", type: "string" },
    { name: "name", label: "Product", type: "string" },
    { name: "status", label: "Status", type: "string" },
    { name: "group", label: "Item Group", type: "string" },
    { name: "uom", label: "UOM", type: "string" },
    { name: "rate", label: "Standard Rate", type: "currency" },
    { name: "created", label: "Created", type: "date" },
  ],
  async resolve() {
    const items = await getItemsServer();
    return (items ?? []).map(toProductRow);
  },
});
