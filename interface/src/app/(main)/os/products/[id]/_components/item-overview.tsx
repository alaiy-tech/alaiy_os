import { Badge } from "@/components/ui/badge";
import { itemDescriptionText } from "@/lib/products";
import type { ItemDetailHeader } from "@/types/products";

import { ExpandableText } from "./expandable-text";

/** The Check fields worth surfacing, shown only where they are set - an item
 * that is not batched says nothing about batches rather than carrying a "No". */
function ItemFlags({ item }: { item: ItemDetailHeader }) {
  const flags = [
    { label: "Stock Item", on: Boolean(item.is_stock_item) },
    { label: "Purchase Item", on: Boolean(item.is_purchase_item) },
    { label: "Sales Item", on: Boolean(item.is_sales_item) },
    { label: "Fixed Asset", on: Boolean(item.is_fixed_asset) },
    { label: "Batched", on: Boolean(item.has_batch_no) },
    { label: "Serialized", on: Boolean(item.has_serial_no) },
  ].filter((flag) => flag.on);

  if (!flags.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <Badge key={flag.label} variant="outline" className="border-0 bg-muted font-normal text-xs">
          {flag.label}
        </Badge>
      ))}
    </div>
  );
}

/**
 * What the item is, in the order someone reading the page needs it: where it
 * sits in the catalogue, what it is used for, then what it says about itself.
 *
 * Deliberately not a Card. It sits beside the gallery as the page's opening
 * statement, and boxing it would put a second frame around content the page
 * header has already introduced.
 */
export function ItemOverview({ item }: { item: ItemDetailHeader }) {
  const description = itemDescriptionText(item.description);
  const classification = [item.brand, item.item_group].filter((part): part is string => Boolean(part?.trim()));

  return (
    <div className="flex flex-col gap-3">
      {classification.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 font-medium text-muted-foreground text-xs uppercase tracking-widest">
          {classification.map((part, position) => (
            <span key={part} className={position === 0 ? "text-foreground" : undefined}>
              {position > 0 && <span className="mr-2 text-muted-foreground/50">·</span>}
              {part}
            </span>
          ))}
        </div>
      )}

      <ItemFlags item={item} />

      {description ? (
        <ExpandableText text={description} />
      ) : (
        <p className="text-muted-foreground text-sm">No description.</p>
      )}
    </div>
  );
}
