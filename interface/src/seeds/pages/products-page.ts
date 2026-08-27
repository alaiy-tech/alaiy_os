// Relative imports, not the usual `@/*` alias - same reason `seed-data.ts`
// documents: this module is reachable from `seeds/seed-headless-db.ts` under
// plain ts-node, which doesn't resolve path aliases at runtime.
import { STATUS_TONE } from "../../constants/list";
import type { PageConfigFile } from "../../types/runtime/page-config";

/**
 * The Products page, rebuilt as a UI Definition from the removed
 * `/os/products` route (`obsolete/pages/os/products/`) - its page header and
 * period toggle (`page.tsx`), its four KPI cards
 * (`_components/product-kpi-cards.tsx`), and its list table
 * (`_components/products.tsx` + `product-columns.tsx`), expressed entirely in
 * the registered component vocabulary instead of bespoke JSX.
 *
 * Bound to the `products.overview` / `products` data sources
 * (`runtime/data/sources/products.ts`); see that file for what the old
 * client-side list could do that this declarative table doesn't.
 */

/** Same tones as the old page's `STATUS_BADGE_CLASS`
 * (`obsolete/data/constants/products.ts`) - a template is a classification
 * rather than a lifecycle state, so it keeps `info`/`structural`. */
const PRODUCT_STATUS_TONES: Record<string, string> = {
  Active: STATUS_TONE.success,
  Template: STATUS_TONE.info,
  Variant: STATUS_TONE.structural,
  Disabled: STATUS_TONE.neutral,
};

export const HEADLESS_PRODUCTS_PAGE: PageConfigFile = {
  id: "products",
  route: "/os/products",
  metadata: {
    title: "Products",
    description: "The /os/products page, composed through the UI runtime instead of hardcoded JSX.",
  },
  definition: {
    id: "headless-products",
    kind: "page",
    children: [
      {
        id: "root-stack",
        kind: "layout",
        type: "stack",
        children: [
          {
            id: "page-header",
            kind: "component",
            type: "os-page-header",
            props: {
              title: "Products",
              subtitle: "Track units sold, stock levels, and catalog health across your product line.",
            },
            children: [
              {
                id: "header-actions",
                kind: "layout",
                type: "inline",
                children: [
                  {
                    id: "period-toggle",
                    kind: "component",
                    type: "os-period-toggle",
                    props: { paramName: "period", defaultPeriod: "1M" },
                  },
                ],
              },
            ],
          },
          {
            id: "kpi-grid",
            kind: "layout",
            type: "grid",
            columns: { base: 1, md: 2, xl: 4 },
            children: [
              {
                id: "kpi-units-sold",
                kind: "component",
                type: "os-kpi",
                props: { title: "Total Units Sold", icon: "ShoppingBag", format: "number" },
                data: {
                  value: { source: "products.overview", path: "units_sold" },
                  trend: { source: "products.overview", path: "units_sold_delta" },
                },
              },
              {
                id: "kpi-on-hand-units",
                kind: "component",
                type: "os-kpi",
                props: { title: "On-Hand Units", icon: "Package", format: "number" },
                data: {
                  value: { source: "products.overview", path: "on_hand_units" },
                  trend: { source: "products.overview", path: "on_hand_units_delta" },
                },
              },
              {
                id: "kpi-average-unit-value",
                kind: "component",
                type: "os-kpi",
                props: { title: "Average Unit Value", icon: "DollarSign", format: "currency" },
                data: {
                  value: { source: "products.overview", path: "average_unit_value" },
                  trend: { source: "products.overview", path: "average_unit_value_delta" },
                  currency: { source: "products.overview", path: "defaultCurrency" },
                },
              },
              {
                id: "kpi-active-skus",
                kind: "component",
                type: "os-kpi",
                props: { title: "Active SKUs", icon: "PackageCheck", format: "number" },
                data: {
                  value: { source: "products.overview", path: "active_skus" },
                  trend: { source: "products.overview", path: "active_skus_delta" },
                },
              },
            ],
          },
          {
            id: "products-table",
            kind: "component",
            type: "os-data-table",
            props: {
              title: "Products",
              rowId: "id",
              searchable: true,
              searchPlaceholder: "Search products...",
              columnVisibility: true,
              // The old page's COMPULSORY_COLUMNS/MIN_VISIBLE_COLUMNS, kept as-is.
              compulsoryColumns: ["name", "status"],
              minVisibleColumns: 4,
              selectable: true,
              paginated: true,
              pageSize: 10,
              emptyMessage: "No products found.",
              columns: [
                { field: "code", label: "Item Code", sortable: true },
                { field: "name", label: "Product", sortable: true, filterable: true },
                {
                  field: "status",
                  label: "Status",
                  format: "badge",
                  filterable: true,
                  filterOptions: ["Active", "Template", "Variant", "Disabled"],
                  badgeTones: PRODUCT_STATUS_TONES,
                },
                { field: "group", label: "Item Group", filterable: true },
                { field: "uom", label: "UOM" },
                { field: "rate", label: "Standard Rate", format: "currency", align: "right", sortable: true },
                { field: "created", label: "Created", format: "date", sortable: true },
              ],
            },
            data: {
              rows: { source: "products" },
              currency: { source: "products.overview", path: "defaultCurrency" },
            },
          },
        ],
      },
    ],
  },
};
