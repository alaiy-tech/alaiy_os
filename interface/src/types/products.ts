import type { ItemRow } from "@/lib/frappe/item-list";
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

export type ProductsOverview = {
  period: string;
  units_sold: PeriodComparison;
  on_hand_units: PeriodComparison;
  average_unit_value: PeriodComparison;
  active_skus: PeriodComparison;
};
