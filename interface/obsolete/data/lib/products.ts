import type { ItemVariant } from "@/lib/frappe/item-variants";
import type { ItemDetailHeader, ItemStockState, ItemStockTotals, ProductStatus } from "@/types/products";

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

/** The Item fields the stock state is read off, again structural so the detail
 * page can derive it from the header plus the summed Bin totals. */
type ItemStockFields = { is_stock_item: 0 | 1; safety_stock: number | null };

/**
 * Whether the item is worth ordering against right now, as one word.
 *
 * Only ever four answers, and the order matters: an item that does not track
 * stock has no quantity to be low on, so "Not Tracked" wins before any figure
 * is compared. "Low Stock" needs a threshold to mean anything, and Item.safety_stock
 * is the only one ERPNext holds - an item without one is either in stock or out,
 * never low, rather than being measured against a number this app invented.
 */
export function getItemStockState(item: ItemStockFields, totals: ItemStockTotals): ItemStockState {
  if (!item.is_stock_item) return "Not Tracked";
  if (totals.actual_qty <= 0) return "Out of Stock";

  const threshold = item.safety_stock ?? 0;
  if (threshold > 0 && totals.actual_qty <= threshold) return "Low Stock";

  return "In Stock";
}

/**
 * Every image this item can show, most representative first.
 *
 * An ERPNext Item carries exactly one image, so the gallery on a template is
 * assembled from its variants' images instead: on a catalogue where the
 * template itself was never given a photo, the variants are all there is to
 * look at, and where it has one, the variants are the rest of the range.
 * Deduplicated because a variant that was never given its own photo is
 * routinely saved carrying the template's.
 */
export function itemGalleryImages(item: Pick<ItemDetailHeader, "image">, variants: ItemVariant[]): string[] {
  const images = [item.image, ...variants.map((variant) => variant.image)];
  return [...new Set(images.filter((image): image is string => Boolean(image?.trim())))];
}

/**
 * Item.description is a Text Editor field, so what comes back is stored HTML.
 * It is shown as text rather than rendered: nothing else in this app injects
 * user-authored HTML into the page, and a catalogue description is not worth
 * being the first thing that does.
 */
export function itemDescriptionText(html: string | null | undefined): string {
  if (!html) return "";

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
