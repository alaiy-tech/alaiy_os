import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatDate, formatQty } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { ItemDetailHeader } from "@/types/products";

import { PageSection } from "./page-section";

const EM_DASH = "—";

/** Frappe returns `""` for an unset Data/Link field and `null` for an unset
 * Date/Float, and a `0` on a Float is a real value that has to survive - so the
 * emptiness test is spelled out rather than left to a falsy check. */
function isEmpty(value: string | number | null | undefined): boolean {
  return value === null || value === undefined || (typeof value === "string" && !value.trim());
}

/**
 * Every remaining Item field, as one flat table.
 *
 * Unset fields keep their row rather than being filtered out: "this item has no
 * country of origin" is a fact an operator came here to check, and a table that
 * silently drops the empties cannot be read as a checklist. Which is also why
 * this is a table and not the card grid it replaced - a key/value list is a
 * shape you scan down a column, and a three-across grid of eighteen fields is
 * one you hunt through.
 */
export function ItemSpecs({ item, currency }: { item: ItemDetailHeader; currency?: string }) {
  const money = (value: number | null) =>
    value === null || value === undefined ? null : formatCurrency(value, { currency });
  const qty = (value: number | null) => (value === null || value === undefined ? null : formatQty(value));
  const days = (value: number | string | null) => (isEmpty(value) ? null : `${value} days`);

  const specs: Array<[string, string | number | null]> = [
    ["Item Code", item.item_code],
    ["Item Group", item.item_group],
    ["Brand", item.brand],
    ["Stock UOM", item.stock_uom],
    ["Purchase UOM", item.purchase_uom],
    ["Sales UOM", item.sales_uom],
    ["Standard Rate", money(item.standard_rate)],
    ["Valuation Rate", money(item.valuation_rate)],
    ["Last Purchase Rate", money(item.last_purchase_rate)],
    ["Min Order Qty", qty(item.min_order_qty)],
    ["Safety Stock", qty(item.safety_stock)],
    ["Lead Time", days(item.lead_time_days)],
    ["Weight", item.weight_per_unit ? `${item.weight_per_unit} ${item.weight_uom ?? ""}`.trim() : null],
    ["Country of Origin", item.country_of_origin],
    ["Warranty", days(item.warranty_period)],
    ["Shelf Life", days(item.shelf_life_in_days)],
    ["End of Life", item.end_of_life ? formatDate(item.end_of_life) : null],
  ];

  return (
    <PageSection id="item-specifications" title="Specifications">
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableBody>
            {specs.map(([label, value], index) => (
              <TableRow key={label} className={index % 2 ? "bg-muted/40 hover:bg-muted/40" : "hover:bg-transparent"}>
                <TableCell className="w-1/3 px-4 py-2.5 font-medium">{label}</TableCell>
                <TableCell className="px-4 py-2.5 text-muted-foreground">{isEmpty(value) ? EM_DASH : value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageSection>
  );
}
