import { Badge } from "@/components/ui/badge";
import { itemDescriptionText } from "@/lib/products";
import type { ItemDetailHeader } from "@/types/products";

import { EditableField } from "./editable-field";
import { EditableToggle } from "./editable-toggle";
import { ExpandableText } from "./expandable-text";

/** The three Checks that decide what the item is *for*, and so what the rest of
 * the OS offers it to — a non-sales item stays out of a Sales Order. Always
 * shown, both states, because a flag an operator might need to turn on cannot
 * be hidden by being off. */
const COMMERCE_FLAGS = [
  { field: "is_stock_item", label: "Stock Item" },
  { field: "is_sales_item", label: "Sales Item" },
  { field: "is_purchase_item", label: "Purchase Item" },
] as const;

/** The Checks that describe how the item is *tracked*. Not editable here:
 * flipping serialization or batching on an item that already has stock
 * movements is a migration, not a preference, and ERPNext guards it. Shown only
 * where set — an item that is not batched says nothing about batches. */
const TRACKING_FLAGS = [
  { key: "is_fixed_asset", label: "Fixed Asset" },
  { key: "has_batch_no", label: "Batched" },
  { key: "has_serial_no", label: "Serialized" },
] as const;

function ItemFlags({ item, canWrite }: { item: ItemDetailHeader; canWrite: boolean }) {
  const tracking = TRACKING_FLAGS.filter((flag) => Boolean(item[flag.key]));
  const commerce = COMMERCE_FLAGS.filter((flag) => canWrite || Boolean(item[flag.field]));

  // Nothing set and nothing to set: the row would be an empty gap between the
  // classification line and the description.
  if (commerce.length === 0 && tracking.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {commerce.map((flag) => (
        <EditableToggle
          key={flag.field}
          item={item.name}
          field={flag.field}
          label={flag.label}
          value={Boolean(item[flag.field])}
          canWrite={canWrite}
        />
      ))}

      {tracking.map((flag) => (
        <Badge
          key={flag.key}
          variant="outline"
          className="border-0 bg-muted font-normal text-xs"
          title="Set on the Item form — changing it on an item with stock movements is not a field edit."
        >
          {flag.label}
        </Badge>
      ))}
    </div>
  );
}

/**
 * The description, editable in place.
 *
 * The stored HTML is both edited and shown as plain text, deliberately: nothing
 * in this app injects user-authored HTML into the page, and a catalogue
 * description is not worth being the first thing that does. The consequence is
 * that saving replaces the field with exactly what the operator sees, so an
 * item whose description was written in the desk's rich-text editor loses that
 * markup the first time it is edited here — which is the open question recorded
 * on #22, not a decision this component should make quietly.
 */
function ItemDescription({ item, canWrite }: { item: ItemDetailHeader; canWrite: boolean }) {
  const description = itemDescriptionText(item.description);
  // Said out loud rather than discovered afterwards: a description authored in
  // the desk's rich-text editor is stored as HTML, and saving the plain text
  // shown here replaces it. Detected by looking for a tag, so a description
  // that was always plain says nothing.
  const hasMarkup = /<[a-z][^>]*>/i.test(item.description ?? "");

  // A reader gets the sentence rather than the em dash an empty editable field
  // would show: there is nothing for them to fill in.
  if (!canWrite) {
    if (!description) return <p className="text-muted-foreground text-sm">No description.</p>;
    return <ExpandableText text={description} />;
  }

  return (
    <EditableField
      item={item.name}
      field="description"
      label="Description"
      kind="multiline"
      value={description}
      display={description ? <ExpandableText text={description} /> : undefined}
      canWrite={canWrite}
      hint={
        hasMarkup ? "This description was written with formatting. Saving here replaces it with plain text." : undefined
      }
    />
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
export function ItemOverview({ item, canWrite }: { item: ItemDetailHeader; canWrite: boolean }) {
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

      <ItemFlags item={item} canWrite={canWrite} />

      <ItemDescription item={item} canWrite={canWrite} />
    </div>
  );
}
