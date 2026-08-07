import type { DocFieldMeta } from "@/components/list/types";
import type { ItemRow } from "@/lib/frappe/item-list";

export type ProductRow = ItemRow & {
  item_code: string;
  item_name: string;
  image: string | null;
  item_group: string;
  disabled: 0 | 1;
  has_variants: 0 | 1;
  variant_of: string | null;
};

export type ProductStatus = "Disabled" | "Template" | "Variant" | "Active";

/** Not a real Item field - derived from disabled/has_variants/variant_of, in
 * that priority order, since a disabled template is still "Disabled" first. */
export function getProductStatus(row: ProductRow): ProductStatus {
  if (row.disabled) return "Disabled";
  if (row.has_variants) return "Template";
  if (row.variant_of) return "Variant";
  return "Active";
}

export const STATUS_BADGE_CLASS: Record<ProductStatus, string> = {
  Active:
    "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  Template:
    "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Variant:
    "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  Disabled: "bg-muted text-muted-foreground",
};

// status is derived, not a real DocField from alaiy_os.api.list_view.get_doctype_fields,
// but still needs to be pickable as a column.
export const SYNTHETIC_COLUMN_FIELDS: DocFieldMeta[] = [
  {
    fieldname: "status",
    label: "Status",
    fieldtype: "Data",
    read_only: true,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
];

export const IMAGE_COLUMN_FIELDNAME = "image";

// The ID (docname) column is always shown first and is neither reorderable
// nor removable - buildProductColumns renders it directly rather than
// sourcing it from columnOrder, so it's not part of the Columns popover at all.
export const ID_COLUMN_FIELDNAME = "ID";

// item_code is a pickable column (toggle-able in the Columns popover) but is
// never rendered as its own table column - buildProductColumns folds it into
// the item_name cell as a muted subtext line instead.
export const ITEM_CODE_COLUMN_FIELDNAME = "item_code";

// height/width/length are deliberately excluded from the default set - they're
// Custom Fields the site may not have synced yet (bench migrate/fixtures),
// and querying a field the site doesn't recognize fails the entire list
// fetch. They're still pickable from the Columns popover once the site's
// meta actually reports them; users opt in explicitly rather than the app
// assuming they exist.
export const DEFAULT_COLUMN_ORDER = [
  "item_name",
  "item_code",
  "item_group",
  "status",
];

export const MIN_VISIBLE_COLUMNS = 4;
