"use client";

import { useState } from "react";
import { ChannelBadge, EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { FilterField, FilterSelect } from "@/components/data/toolbar";
import { pressClass } from "@/components/ui";
import type { ChannelId } from "@/lib/backend/types";
import { formatMoney, formatNumber } from "@/lib/format";
import { grossMarginPct, totalFees } from "@/lib/profitability/presentation";
import type { ChannelPnlRow } from "@/lib/profitability/types";

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
 */
export function PnlTable({ rows }: { rows: ChannelPnlRow[] }) {
  const [channel, setChannel] = useState<ChannelId | "">("");
  const [sku, setSku] = useState("");

  const skus = [...new Set(rows.map((r) => r.sku))].sort();

  const filtered = rows.filter(
    (r) => (!channel || r.channel === channel) && (!sku || r.sku === sku),
  );

  const isFiltered = Boolean(channel || sku);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-3">
        <FilterField label="SKU">
          <FilterSelect
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            options={[{ value: "", label: "All SKUs" }, ...skus.map((s) => ({ value: s, label: s }))]}
          />
        </FilterField>
        <FilterField label="Channel">
          <FilterSelect
            value={channel}
            onChange={(event) => setChannel(event.target.value as ChannelId | "")}
            options={[
              { value: "", label: "All channels" },
              { value: "amazon", label: "Amazon" },
              { value: "shopify", label: "Shopify" },
            ]}
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
            <EmptyRow colSpan={COLUMN_COUNT}>No listings match those filters.</EmptyRow>
          ) : (
            filtered.map((row) => <PnlRow key={`${row.channel}:${row.sku}`} row={row} />)
          )}
        </tbody>
      </TableFrame>
    </div>
  );
}

function PnlRow({ row }: { row: ChannelPnlRow }) {
  return (
    <tr className="transition-colors hover:bg-primary-600/[0.04]">
      <Td className="font-medium">
        {row.title}
        <span className="block font-data text-[11.5px] text-muted-soft">{row.sku}</span>
      </Td>
      <Td>
        <ChannelBadge channel={row.channel} />
      </Td>
      <Td align="right">{formatMoney(row.revenue, "INR")}</Td>
      <Td align="right">{formatNumber(row.units)}</Td>
      <Td align="right">{moneyOrDash(row.amazonReferralFee + row.amazonFbaFee)}</Td>
      <Td align="right">{moneyOrDash(row.shopifyTransactionFee)}</Td>
      <Td align="right">
        {formatMoney(row.shippingCost, "INR")}
        {row.shippingCostBasis === "estimated" ? <EstimatedMark /> : null}
      </Td>
      <Td align="right">
        <ComingSoon />
      </Td>
      <Td align="right">
        <MarginValue pct={grossMarginPct(row, totalFees(row))} />
      </Td>
      <Td align="right">
        <ComingSoon />
      </Td>
      <Td align="right">
        <BuyBoxCell pct={row.buyBoxWinPct} />
      </Td>
    </tr>
  );
}

function moneyOrDash(value: number) {
  return value > 0 ? formatMoney(value, "INR") : <span className="text-muted-soft">—</span>;
}

function MarginValue({ pct }: { pct: number }) {
  const tone = pct < 0 ? "text-alert-ink font-semibold" : pct < 20 ? "text-warn-ink" : "text-ok-ink";
  return <span className={tone}>{pct.toFixed(1)}%</span>;
}

function BuyBoxCell({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-soft">—</span>;
  return <span className={pct < 75 ? "font-semibold text-alert-ink" : "text-ink"}>{pct}%</span>;
}

function ComingSoon() {
  return (
    <span
      className="text-[11px] text-muted-soft"
      title="Needs per-PO-line COGS, which isn't connected yet — coming soon."
    >
      Coming soon
    </span>
  );
}

function EstimatedMark() {
  return (
    <span
      className="ml-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-warn-ink"
      title="No WMS connected — this is Jordan's own manual per-SKU estimate, not an actual."
    >
      est.
    </span>
  );
}
