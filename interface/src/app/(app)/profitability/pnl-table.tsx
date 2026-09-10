"use client";

import { useState } from "react";
import { ChannelBadge, EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { FilterField, FilterSelect } from "@/components/data/toolbar";
import { pressClass } from "@/components/ui";
import { channelOptions } from "@/lib/channels";
import type { ChannelId } from "@/lib/backend/types";
import { formatMoney, formatNumber } from "@/lib/format";
import type { ChannelPnlRow, FeeBasis } from "@/lib/profitability/types";

const COLUMN_COUNT = 11;

/**
 * The P&L table: one row per (channel, SKU).
 *
 * These rows used to collapse under a Product Group, expandable to the channel
 * rows beneath. The grouping is gone app-wide — the thing that decided two
 * channels' listings were one product was a barcode match or a title score, and
 * a rolled-up margin built on a wrong pairing is a wrong number with no way to
 * see that it is wrong. Per channel is also the grain the numbers are true at:
 * the fee structure, the price and the margin genuinely differ per channel, so
 * the combined figure was never the one to act on.
 *
 * Filtering by channel filters the rows directly — "Amazon only" shows the
 * Amazon numbers alone, which is what "see the full impact of Amazon's fee
 * structure per SKU" in the issue actually asks for.
 *
 * Three columns say "coming soon" rather than showing a number, and that is
 * deliberate in each case: shipping cost needs a WMS, COGS needs lot-level
 * cost per PO line, and net margin is the figure that needs COGS. Hiding them
 * would let the gross margin read as the whole answer.
 */
export function PnlTable({
  rows,
  currency,
}: {
  rows: ChannelPnlRow[];
  currency: string;
}) {
  const [channel, setChannel] = useState<ChannelId | "">("");
  const [sku, setSku] = useState("");

  const skus = [...new Set(rows.map((r) => r.sku))].sort();

  const filtered = rows
    .filter((r) => (!channel || r.channel === channel) && (!sku || r.sku === sku))
    // Biggest first, so the products worth arguing about are on screen. The
    // point of the tab is that this order is *not* the margin order.
    .sort((a, b) => b.revenue - a.revenue);

  const isFiltered = Boolean(channel || sku);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-3">
        <FilterField label="SKU">
          <FilterSelect
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            options={[
              { value: "", label: "All SKUs" },
              ...skus.map((s) => ({ value: s, label: s })),
            ]}
          />
        </FilterField>
        <FilterField label="Channel">
          <FilterSelect
            value={channel}
            onChange={(event) => setChannel(event.target.value as ChannelId | "")}
            options={[{ value: "", label: "All channels" }, ...channelOptions()]}
          />
        </FilterField>
        {isFiltered ? (
          <button
            type="button"
            onClick={() => {
              setChannel("");
              setSku("");
            }}
            className={pressClass({ ground: "quiet", size: "sm" })}
          >
            Clear
          </button>
        ) : null}
      </div>

      <TableFrame minWidth="76rem">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>Channel</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">Units</Th>
            <Th align="right">Amazon fees</Th>
            <Th align="right">Shopify fees</Th>
            <Th align="right">Shipping</Th>
            <Th align="right">COGS</Th>
            <Th align="right">Gross margin</Th>
            <Th align="right">Net margin</Th>
            <Th align="right">Buy Box win</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <EmptyRow colSpan={COLUMN_COUNT}>
              {isFiltered ? "No listings match those filters." : "No sales in this period."}
            </EmptyRow>
          ) : (
            filtered.map((row) => (
              <PnlRow key={`${row.channel}:${row.sku}`} row={row} currency={currency} />
            ))
          )}
        </tbody>
      </TableFrame>
    </div>
  );
}

function PnlRow({ row, currency }: { row: ChannelPnlRow; currency: string }) {
  return (
    <tr className="transition-colors hover:bg-primary-600/[0.04]">
      <Td className="font-medium">
        {row.title}
        <span className="block font-data text-[11.5px] text-muted-soft">{row.sku}</span>
      </Td>
      <Td>
        <ChannelBadge channel={row.channel} />
      </Td>
      <Td align="right">{formatMoney(row.revenue, currency)}</Td>
      <Td align="right">{formatNumber(row.units)}</Td>
      <Td align="right">
        <FeeCell
          value={row.amazon_referral_fee + row.amazon_fba_fee + row.amazon_other_fee}
          available={row.fees_available}
          basis={row.fee_basis}
          currency={currency}
          applies={row.channel === "amazon"}
          note={row.fee_note}
          settledUnits={row.settled_units}
          units={row.units}
        />
      </Td>
      <Td align="right">
        <FeeCell
          value={row.shopify_transaction_fee}
          available={row.fees_available}
          basis={row.fee_basis}
          currency={currency}
          applies={row.channel === "shopify"}
          note={row.fee_note}
        />
      </Td>
      <Td align="right">
        <ComingSoon reason="shipping" />
      </Td>
      <Td align="right">
        <ComingSoon reason="cogs" />
      </Td>
      <Td align="right">
        <MarginValue pct={row.gross_margin_pct} />
      </Td>
      <Td align="right">
        <ComingSoon reason="net" />
      </Td>
      <Td align="right">
        <BuyBoxCell pct={row.buy_box_win_pct} />
      </Td>
    </tr>
  );
}

/**
 * One fee figure, with the three answers it can have.
 *
 * A dash means one of two different things and the tooltip is what separates
 * them: this channel does not charge this kind of fee (`applies` false), or we
 * have not been told what it charged (`available` false). Neither is zero, and
 * rendering either as ₹0 would show the SKU with unknown costs as the best
 * margin on the page.
 */
function FeeCell({
  value,
  available,
  basis,
  currency,
  applies,
  note,
  settledUnits,
  units,
}: {
  value: number;
  available: boolean;
  basis: FeeBasis;
  currency: string;
  applies: boolean;
  note?: string | null;
  settledUnits?: number;
  units?: number;
}) {
  if (!applies) return <span className="text-muted-soft">—</span>;

  if (!available) {
    return (
      <span
        className="text-muted-soft"
        title={note ?? "This channel hasn't reported fees for this product yet."}
      >
        Unknown
      </span>
    );
  }

  return (
    <span>
      {formatMoney(value, currency)}
      {basis !== "actual" ? (
        <EstimatedMark settledUnits={settledUnits} units={units} />
      ) : null}
    </span>
  );
}

function MarginValue({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span
        className="text-muted-soft"
        title="Some fees on this row are unknown, so there is no margin to state. A margin computed from a fee we don't have would be a guess with a decimal point on it."
      >
        —
      </span>
    );
  }
  const tone = pct < 0 ? "text-alert-ink font-semibold" : pct < 20 ? "text-warn-ink" : "text-ok-ink";
  return <span className={tone}>{pct.toFixed(1)}%</span>;
}

function BuyBoxCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-soft">—</span>;
  return (
    <span className={pct < 75 ? "font-semibold text-alert-ink" : "text-ink"}>
      {pct.toFixed(0)}%
    </span>
  );
}

const COMING_SOON: Record<string, string> = {
  shipping:
    "Needs a connected WMS for per-SKU shipping cost — coming soon. Gross margin below is before shipping.",
  cogs: "Needs lot-level cost per PO line, which isn't connected yet — coming soon.",
  net: "Net margin is the figure that needs COGS. It reads 'coming soon' rather than silently repeating the gross margin.",
};

function ComingSoon({ reason }: { reason: keyof typeof COMING_SOON | string }) {
  return (
    <span className="text-[11px] text-muted-soft" title={COMING_SOON[reason]}>
      Coming soon
    </span>
  );
}

/**
 * The mark that keeps this tab honest.
 *
 * Amazon settles two to four weeks after a sale, so a recent window is
 * normally part-quoted — and a seller who reads a quote as an actual and
 * prices against it cannot detect the mistake from anything on screen. The
 * tooltip says how much of the row is settled rather than only that some of it
 * is not.
 */
function EstimatedMark({
  settledUnits,
  units,
}: {
  settledUnits?: number;
  units?: number;
}) {
  const coverage =
    settledUnits !== undefined && units !== undefined && units > 0
      ? ` ${formatNumber(settledUnits)} of ${formatNumber(units)} units have settled.`
      : "";

  return (
    <span
      className="ml-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-warn-ink"
      title={`Amazon's quote for what it would charge, not what it has taken — it settles two to four weeks after a sale.${coverage}`}
    >
      est.
    </span>
  );
}
