import type { ItemRow } from "@/lib/frappe/item-list";
import type { ItemVariant } from "@/lib/frappe/item-variants";
import type { PeriodComparison } from "@/types/list";

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

/** Derived from is_stock_item plus the item's summed Bin quantities - see
 * getItemStockState. Not an Item field, and deliberately only four words: it
 * answers "can I sell this today", not "how much is there". */
export type ItemStockState = "In Stock" | "Low Stock" | "Out of Stock" | "Not Tracked";

export type ProductsOverview = {
  period: string;
  units_sold: PeriodComparison;
  on_hand_units: PeriodComparison;
  average_unit_value: PeriodComparison;
  active_skus: PeriodComparison;
};

/** The Item's own fields, as returned by alaiy_os.api.item.get_item_detail.
 * Nullable across the board because most of these are optional on the doctype
 * — Frappe returns "" for an unset Data/Link field and null for an unset
 * Date/Float, and neither means the detail page has nothing to draw. */
export type ItemDetailHeader = {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string | null;
  brand: string | null;
  description: string | null;
  image: string | null;
  disabled: 0 | 1;
  has_variants: 0 | 1;
  variant_of: string | null;
  variant_based_on: string | null;
  is_stock_item: 0 | 1;
  is_purchase_item: 0 | 1;
  is_sales_item: 0 | 1;
  is_fixed_asset: 0 | 1;
  has_batch_no: 0 | 1;
  has_serial_no: 0 | 1;
  stock_uom: string | null;
  purchase_uom: string | null;
  sales_uom: string | null;
  standard_rate: number | null;
  valuation_rate: number | null;
  last_purchase_rate: number | null;
  min_order_qty: number | null;
  safety_stock: number | null;
  lead_time_days: number | null;
  shelf_life_in_days: number | null;
  end_of_life: string | null;
  warranty_period: string | null;
  weight_per_unit: number | null;
  weight_uom: string | null;
  country_of_origin: string | null;
};

/** One Bin row — ERPNext keeps one per (item, warehouse) and creates it lazily,
 * so a warehouse the item has never moved through simply has no row here. */
export type ItemStockRow = {
  warehouse: string;
  stock_uom: string | null;
  actual_qty: number;
  reserved_qty: number;
  ordered_qty: number;
  indented_qty: number;
  projected_qty: number;
  valuation_rate: number;
  stock_value: number;
};

export type ItemStockTotals = {
  actual_qty: number;
  reserved_qty: number;
  ordered_qty: number;
  indented_qty: number;
  projected_qty: number;
  stock_value: number;
};

export type ItemPriceRow = {
  name: string;
  price_list: string;
  price_list_rate: number | null;
  currency: string | null;
  uom: string | null;
  buying: 0 | 1;
  selling: 0 | 1;
  customer: string | null;
  supplier: string | null;
  valid_from: string | null;
  valid_upto: string | null;
};

export type ItemAttributeRow = {
  idx: number;
  attribute: string;
  attribute_value: string | null;
};

export type ItemDetail = {
  item: ItemDetailHeader;
  /** The template this item is a variant of, or null when it isn't one. */
  template: { name: string; item_name: string | null } | null;
  stock: { bins: ItemStockRow[]; totals: ItemStockTotals };
  prices: ItemPriceRow[];
  attributes: ItemAttributeRow[];
  variants: ItemVariant[];
  /** Bin and Item Price carry their own permissions — false means "not shown",
   * which the page has to say out loud rather than render as an empty table. */
  can_read: { stock: boolean; prices: boolean };
  /** Whether this user may write the Item. Decides whether the page offers edit
   * affordances at all; it is not what protects the write, which checks the
   * permission again server-side. */
  can_write: { item: boolean };
};
