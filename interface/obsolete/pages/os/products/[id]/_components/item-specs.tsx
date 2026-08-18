import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/primitive/table";
import { formatDate, formatQty } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { ItemDetailHeader } from "@/types/products";

import { EditableField, type EditableKind } from "./editable-field";
import { PageSection } from "./page-section";

const EM_DASH = "—";

/** Frappe returns `""` for an unset Data/Link field and `null` for an unset
 * Date/Float, and a `0` on a Float is a real value that has to survive - so the
 * emptiness test is spelled out rather than left to a falsy check. */
function isEmpty(value: string | number | null | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim())
  );
}

type Editable = {
  label: string;
  field: string;
  kind: EditableKind;
  value: string | number | null;
  /** How the stored value reads when it is not being edited — a formatted
   * currency, a date in the reader's locale, a figure with its unit. */
  display?: ReactNode;
  /** The doctype a Link field points at, whose names the editor suggests. */
  linkDoctype?: string;
};

/** A field the page shows but will not write, and the reason, which is shown on
 * hover rather than left for the operator to discover by trying. */
type Locked = { label: string; value: string | number | null; reason: string };

type SpecRow = Editable | Locked;

function isLocked(row: SpecRow): row is Locked {
  return "reason" in row;
}

/**
 * Every Item field this page carries, as one flat table — and the page's main
 * editing surface.
 *
 * Unset fields keep their row rather than being filtered out: "this item has no
 * country of origin" is a fact an operator came here to check, and a table that
 * silently drops the empties can be neither read as a checklist nor used to
 * fill one in. Which is also why this is a table and not the card grid it
 * replaced - a key/value list is a shape you scan down a column, and a
 * three-across grid of eighteen fields is one you hunt through.
 */
export function ItemSpecs({
  item,
  currency,
  canWrite,
}: {
  item: ItemDetailHeader;
  currency?: string;
  canWrite: boolean;
}) {
  const money = (value: number | null) =>
    value === null || value === undefined
      ? null
      : formatCurrency(value, { currency });
  const days = (value: number | string | null) =>
    isEmpty(value) ? null : `${value} days`;

  const specs: SpecRow[] = [
    {
      label: "Item Code",
      value: item.item_code,
      reason:
        "The document's own name, set by the Item naming series when it was created.",
    },
    {
      label: "Item Group",
      field: "item_group",
      kind: "link",
      linkDoctype: "Item Group",
      value: item.item_group,
    },
    {
      label: "Brand",
      field: "brand",
      kind: "link",
      linkDoctype: "Brand",
      value: item.brand,
    },
    {
      label: "Stock UOM",
      field: "stock_uom",
      kind: "link",
      linkDoctype: "UOM",
      value: item.stock_uom,
    },
    {
      label: "Purchase UOM",
      field: "purchase_uom",
      kind: "link",
      linkDoctype: "UOM",
      value: item.purchase_uom,
    },
    {
      label: "Sales UOM",
      field: "sales_uom",
      kind: "link",
      linkDoctype: "UOM",
      value: item.sales_uom,
    },
    {
      label: "Standard Rate",
      field: "standard_rate",
      kind: "number",
      value: item.standard_rate,
      display: money(item.standard_rate),
    },
    {
      label: "Valuation Rate",
      value: money(item.valuation_rate),
      reason:
        "Derived by ERPNext from this item's stock movements — not a figure to type.",
    },
    {
      label: "Last Purchase Rate",
      value: money(item.last_purchase_rate),
      reason: "Written by ERPNext from the last purchase of this item.",
    },
    {
      label: "Min Order Qty",
      field: "min_order_qty",
      kind: "number",
      value: item.min_order_qty,
      display:
        item.min_order_qty === null ? null : formatQty(item.min_order_qty),
    },
    {
      label: "Safety Stock",
      field: "safety_stock",
      kind: "number",
      value: item.safety_stock,
      display: item.safety_stock === null ? null : formatQty(item.safety_stock),
    },
    {
      label: "Lead Time",
      field: "lead_time_days",
      kind: "number",
      value: item.lead_time_days,
      display: days(item.lead_time_days),
    },
    {
      label: "Weight",
      field: "weight_per_unit",
      kind: "number",
      value: item.weight_per_unit,
      // The unit is Item.weight_uom, which is not editable here — an item with
      // a weight and no UOM shows the figure alone, exactly as ERPNext stores it.
      display: item.weight_per_unit
        ? `${item.weight_per_unit} ${item.weight_uom ?? ""}`.trim()
        : null,
    },
    {
      label: "Country of Origin",
      field: "country_of_origin",
      kind: "link",
      linkDoctype: "Country",
      value: item.country_of_origin,
    },
    {
      // Item.warranty_period is a Data field holding a number of days, not an
      // Int — so it is edited as text and read back with its unit appended.
      label: "Warranty",
      field: "warranty_period",
      kind: "text",
      value: item.warranty_period,
      display: days(item.warranty_period),
    },
    {
      label: "Shelf Life",
      field: "shelf_life_in_days",
      kind: "number",
      value: item.shelf_life_in_days,
      display: days(item.shelf_life_in_days),
    },
    {
      label: "End of Life",
      field: "end_of_life",
      kind: "date",
      value: item.end_of_life,
      display: item.end_of_life ? formatDate(item.end_of_life) : null,
    },
  ];

  return (
    <PageSection id="item-specifications" title="Specifications">
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableBody>
            {specs.map((row, index) => (
              <TableRow
                key={row.label}
                className={
                  index % 2
                    ? "bg-muted/40 hover:bg-muted/40"
                    : "hover:bg-transparent"
                }
              >
                <TableCell className="w-1/3 px-4 py-2.5 font-medium">
                  {row.label}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">
                  {isLocked(row) ? (
                    <span
                      title={row.reason}
                      className="cursor-help decoration-dotted underline-offset-4 hover:underline"
                    >
                      {isEmpty(row.value) ? EM_DASH : row.value}
                    </span>
                  ) : (
                    <EditableField
                      item={item.name}
                      field={row.field}
                      label={row.label}
                      kind={row.kind}
                      value={row.value}
                      display={row.display ?? undefined}
                      linkDoctype={row.linkDoctype}
                      canWrite={canWrite}
                      className="w-full"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageSection>
  );
}
