import type { ProductStatus } from "@/types/products";

/** The three Item fields the status is read off. Typed structurally rather than
 * as ProductRow so the detail page's header (which is not a list row) derives
 * its badge from the same rule the table does. */
type ProductStatusFields = {
  disabled: 0 | 1;
  has_variants: 0 | 1;
  variant_of: string | null;
};

/** Not a real Item field - derived from disabled/has_variants/variant_of, in
 * that priority order, since a disabled template is still "Disabled" first. */
export function getProductStatus(item: ProductStatusFields): ProductStatus {
  if (item.disabled) return "Disabled";
  if (item.has_variants) return "Template";
  if (item.variant_of) return "Variant";
  return "Active";
}
