import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ITEM_IMAGE_REFERRER_POLICY } from "@/constants/products";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { ItemDetailHeader } from "@/types/products";

import { Field, ValueField } from "./field";

/** Item.description is a Text Editor field, so what comes back is stored HTML.
 * It is shown as text rather than rendered: nothing else in this app injects
 * user-authored HTML into the page, and a catalog description is not worth
 * being the first thing that does. */
function asPlainText(html: string): string {
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

/** The Check fields worth surfacing, shown only where they are set — an item
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

export function ItemSummary({ item, currency }: { item: ItemDetailHeader; currency?: string }) {
  const money = (value: number | null) =>
    value === null || value === undefined ? null : formatCurrency(value, { currency });
  const description = item.description ? asPlainText(item.description) : "";
  const weight = item.weight_per_unit ? `${item.weight_per_unit} ${item.weight_uom ?? ""}`.trim() : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Item</CardTitle>
        <CardDescription className="text-foreground text-xl leading-none tracking-tight">
          {item.item_name}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex gap-4">
          <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {item.image ? (
              <img
                src={item.image}
                alt={item.item_name}
                referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-muted-foreground text-xs">No image</span>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <ItemFlags item={item} />
            {description ? (
              <p className="line-clamp-4 text-muted-foreground text-sm">{description}</p>
            ) : (
              <p className="text-muted-foreground text-sm">No description.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <ValueField label="Item Code" value={item.item_code} />
          <ValueField label="Item Group" value={item.item_group} />
          <ValueField label="Brand" value={item.brand} />
          <ValueField label="Stock UOM" value={item.stock_uom} />
          <ValueField label="Purchase UOM" value={item.purchase_uom} />
          <ValueField label="Sales UOM" value={item.sales_uom} />
          <ValueField label="Standard Rate" value={money(item.standard_rate)} />
          <ValueField label="Valuation Rate" value={money(item.valuation_rate)} />
          <ValueField label="Last Purchase Rate" value={money(item.last_purchase_rate)} />
          <ValueField label="Min Order Qty" value={item.min_order_qty} />
          <ValueField label="Safety Stock" value={item.safety_stock} />
          <ValueField label="Lead Time" value={item.lead_time_days ? `${item.lead_time_days} days` : null} />
          <ValueField label="Weight" value={weight} />
          <ValueField label="Country of Origin" value={item.country_of_origin} />
          <ValueField label="Warranty" value={item.warranty_period ? `${item.warranty_period} days` : null} />
          <ValueField label="Shelf Life" value={item.shelf_life_in_days ? `${item.shelf_life_in_days} days` : null} />
          <Field label="End of Life">
            {item.end_of_life ? formatDate(item.end_of_life) : <span className="text-muted-foreground">—</span>}
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
