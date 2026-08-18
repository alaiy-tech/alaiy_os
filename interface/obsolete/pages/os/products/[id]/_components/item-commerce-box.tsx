import type { ReactNode } from "react";

import {
  Boxes,
  CalendarClock,
  LifeBuoy,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import {
  DEFAULT_STOCK_STATE_BADGE_CLASS,
  getStockStateBadgeClass,
} from "@/constants/products";
import { formatDate, formatQty, labelOr } from "@/lib/format";
import { getItemStockState } from "@/lib/products";
import { cn, formatCurrency } from "@/lib/utils";
import type { ItemDetail, ItemDetailHeader } from "@/types/products";

import { EditableField } from "./editable-field";
import { EditableToggle } from "./editable-toggle";

const EM_DASH = "—";

/** A label/value pair on one line, the sidebar's smallest unit. Sized
 * grid-cols-[auto_1fr] by the parent rather than split down the middle: the
 * labels are short and the values (a brand, a country) need the room. */
function Fact({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <>
      <span className="self-center whitespace-nowrap text-muted-foreground text-xs">
        {label}
      </span>
      <span className="min-w-0 break-words font-medium text-sm">
        {value?.trim() ? (
          value
        ) : (
          <span className="font-normal text-muted-foreground">{EM_DASH}</span>
        )}
      </span>
    </>
  );
}

/** An icon chip beside a figure that has a consequence for ordering - how long
 * a replenishment takes, how little can be bought, when the item stops being
 * sellable. Only rendered where the field is actually set. */
function Signal({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="font-medium text-sm">{value}</div>
        <div className="truncate text-muted-foreground text-xs">{label}</div>
      </div>
    </div>
  );
}

/** Every ordering signal the Item carries a value for, in the order an operator
 * reads them: how long it takes, how much has to be bought, how long it lasts. */
function orderingSignals(item: ItemDetailHeader) {
  return [
    item.lead_time_days
      ? {
          key: "lead",
          icon: <Truck className="size-4" />,
          label: "Lead time",
          value: `${item.lead_time_days} days`,
        }
      : null,
    item.min_order_qty
      ? {
          key: "moq",
          icon: <Boxes className="size-4" />,
          label: "Minimum order quantity",
          value:
            `${formatQty(item.min_order_qty)} ${labelOr(item.stock_uom, "")}`.trim(),
        }
      : null,
    item.safety_stock
      ? {
          key: "safety",
          icon: <LifeBuoy className="size-4" />,
          label: "Safety stock",
          value:
            `${formatQty(item.safety_stock)} ${labelOr(item.stock_uom, "")}`.trim(),
        }
      : null,
    item.warranty_period
      ? {
          key: "warranty",
          icon: <ShieldCheck className="size-4" />,
          label: "Warranty",
          value: `${item.warranty_period} days`,
        }
      : null,
    item.shelf_life_in_days
      ? {
          key: "shelf",
          icon: <CalendarClock className="size-4" />,
          label: "Shelf life",
          value: `${item.shelf_life_in_days} days`,
        }
      : null,
    item.end_of_life
      ? {
          key: "eol",
          icon: <CalendarClock className="size-4" />,
          label: "End of life",
          value: formatDate(item.end_of_life),
        }
      : null,
  ].filter((signal): signal is NonNullable<typeof signal> => signal !== null);
}

/**
 * The commerce panel: what the item is worth and whether it can be sold today.
 *
 * This is the page's answer to a storefront's buy box, and it sits in the same
 * place for the same reason - the two questions an operator opens a product to
 * ask are "what does it cost" and "is there any", and neither should need a
 * scroll. Where a storefront would close with a call to action, this stops at
 * the figures: the page reads the Item and nothing here writes it.
 */
export function ItemCommerceBox({
  item,
  stock,
  canReadStock,
  warehouseCount,
  currency,
  canWrite,
}: {
  item: ItemDetailHeader;
  stock: ItemDetail["stock"]["totals"];
  canReadStock: boolean;
  warehouseCount: number;
  currency?: string;
  canWrite: boolean;
}) {
  const money = (value: number | null) =>
    value === null || value === undefined
      ? null
      : formatCurrency(value, { currency });
  const stockState = getItemStockState(item, stock);
  const signals = orderingSignals(item);
  const uom = labelOr(item.stock_uom, "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl bg-muted/60 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">Standard rate</span>
          {/* The one figure on this panel that is a decision rather than a
           * derivation, so it is the one that is editable here. Valuation and
           * last purchase below are computed by ERPNext from stock movements. */}
          <EditableField
            item={item.name}
            field="standard_rate"
            label="Standard rate"
            kind="number"
            value={item.standard_rate}
            display={
              money(item.standard_rate) ?? (
                <span className="text-muted-foreground text-xl">Not set</span>
              )
            }
            canWrite={canWrite}
            className="font-heading text-3xl tabular-nums leading-none tracking-tight"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs">Valuation</span>
            <span className="truncate font-medium text-sm tabular-nums">
              {money(item.valuation_rate) ?? EM_DASH}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs">Last purchase</span>
            <span className="truncate font-medium text-sm tabular-nums">
              {money(item.last_purchase_rate) ?? EM_DASH}
            </span>
          </div>
        </div>
      </div>

      {/* Stock reads as one sentence rather than a figure: the badge is the
       * decision (can this be sold today) and the line beside it is the
       * evidence. Bin carries its own permission, so a user who cannot read it
       * is told that instead of being shown a confident zero. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Grey, not the state's own colour, when Bin is unreadable: with no
         * rows to sum the totals are all zero, and colouring that "Out of
         * Stock" red would state as fact the one thing this user cannot see. */}
        <Badge
          variant="outline"
          className={cn(
            "border-0 font-medium",
            canReadStock
              ? getStockStateBadgeClass(stockState)
              : DEFAULT_STOCK_STATE_BADGE_CLASS,
          )}
        >
          {canReadStock ? stockState : "Stock not shown"}
        </Badge>
        {canReadStock && Boolean(item.is_stock_item) && warehouseCount > 0 && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {`${formatQty(stock.actual_qty)}${uom ? ` ${uom}` : ""} in ${warehouseCount} ${
              warehouseCount === 1 ? "warehouse" : "warehouses"
            }`}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border p-4">
        {/* Whether the item is sellable at all, which is what the rest of this
         * panel is describing — so it belongs here rather than buried in the
         * field table. Stored inverted: the Item field is `disabled`. */}
        <EditableToggle
          item={item.name}
          field="disabled"
          label="Active"
          value={Boolean(item.disabled)}
          canWrite={canWrite}
          as="switch"
          invert
        />

        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t pt-3">
          <Fact label="Item code" value={item.item_code} />
          <Fact label="Item group" value={item.item_group} />
          <Fact label="Brand" value={item.brand} />
          <Fact label="Stock UOM" value={item.stock_uom} />
          <Fact label="Origin" value={item.country_of_origin} />
        </div>
      </div>

      {signals.length > 0 && (
        <div className="flex flex-col gap-3 border-t pt-4">
          {signals.map((signal) => (
            <Signal
              key={signal.key}
              icon={signal.icon}
              label={signal.label}
              value={signal.value}
            />
          ))}
        </div>
      )}
    </div>
  );
}
