import type { PeriodComparison } from "./list";

/** Returned by `alaiy_os.api.item_stats.get_products_overview` - the same
 * four period-over-period figures the removed `/os/products` page's KPI
 * cards read (`obsolete/pages/os/products/_components/product-kpi-cards.tsx`),
 * now consumed by the `products.overview` data source instead. */
export type ProductsOverview = {
  period: string;
  units_sold: PeriodComparison;
  on_hand_units: PeriodComparison;
  average_unit_value: PeriodComparison;
  active_skus: PeriodComparison;
};

/** Not a real Item field - derived from disabled/has_variants/variant_of, in
 * that priority order, since a disabled template is still "Disabled" first.
 * Same rule as the old page's `getProductStatus`
 * (`obsolete/data/lib/products.ts`). */
export type ProductStatus = "Disabled" | "Template" | "Variant" | "Active";

/** The Item fields the products list reads. Deliberately narrower than the
 * old page's user-configurable `columnOrder`: a UI-runtime page's columns are
 * fixed by its definition, so the fetch list is fixed too - and every field
 * here is a stock ERPNext Item field, never a Custom Field a site may not
 * have synced (the failure `constants/products.ts` documented). */
export type ItemListFields = {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string | null;
  stock_uom: string | null;
  standard_rate: number | null;
  disabled: 0 | 1;
  has_variants: 0 | 1;
  variant_of: string | null;
  creation: string;
};
