import type { DocFieldMeta } from "@/types/list";
import type { ProductStatus } from "@/types/products";

export const ITEM_DOCTYPE = "Item";

// status is derived (see getProductStatus), not a real DocField from
// alaiy_os.api.list_view.get_doctype_fields, but still needs to be pickable
// as a column.
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

// Always fetched regardless of columnOrder - needed for row identity,
// the merged image+name cell, status derivation, and the variant accordion.
export const BASE_FIELDS = [
  "name",
  "item_code",
  "item_name",
  "image",
  "item_group",
  "disabled",
  "has_variants",
  "variant_of",
];

// The ID (docname) column is always shown first and is neither reorderable
// nor removable - buildProductColumns renders it directly rather than
// sourcing it from columnOrder, so it's not part of the Columns popover at all.
export const ID_COLUMN_FIELDNAME = "name";

export const IMAGE_COLUMN_FIELDNAME = "image";

// item_code is a pickable column (toggle-able in the Columns popover) but is
// never rendered as its own table column - buildProductColumns folds it into
// the item_name cell as a muted subtext line instead.
export const ITEM_CODE_COLUMN_FIELDNAME = "item_code";

// Columns shown the first time the Products table is ever opened (before any
// user customization is saved). height/width/length are deliberately
// excluded - they're Custom Fields the site may not have synced yet
// (bench migrate/fixtures), and querying a field the site doesn't recognize
// fails the entire list fetch. They're still pickable from the Columns
// popover once the site's meta actually reports them.
export const DEFAULT_COLUMN_ORDER = ["item_name", "item_group", "status"];

// Columns the user can never remove from columnOrder, on top of the ID
// column above (which isn't part of columnOrder at all). item_name carries
// the merged image+name cell, so it doubles as "must always show a product's
// image and name."
export const COMPULSORY_COLUMNS = ["item_name", "status"];

export const MIN_VISIBLE_COLUMNS = 4;

export const STATUS_BADGE_CLASS: Record<ProductStatus, string> = {
  Active: "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  Template: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Variant: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  Disabled: "bg-muted text-muted-foreground",
};

// Default cards-per-row for the grid view at its largest breakpoint.
export const GRID_CARDS_PER_ROW = 6;
