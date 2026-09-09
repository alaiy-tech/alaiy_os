"use client";

import { useState } from "react";
import { ChannelBadge, EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { FilterField, FilterSelect } from "@/components/data/toolbar";
import { pressClass } from "@/components/ui";
import type { ChannelId } from "@/lib/backend/types";
import { formatMoney, formatNumber } from "@/lib/format";
import { grossMarginPct, rollupByProductGroup, totalFees, type GroupRollup } from "@/lib/profitability/presentation";
import type { ChannelPnlRow } from "@/lib/profitability/types";

const COLUMN_COUNT = 11;

/**
 * The P&L table: one row per Product Group, expandable to the channel rows
 * underneath.
 *
 * Filtering by channel filters the *raw* rows before anything is rolled up
 * — "Amazon only" shows each group's Amazon numbers alone, not the combined
 * total with Amazon's share highlighted, which is what "see the full impact
 * of Amazon's fee structure per SKU" in the issue actually asks for.
 */
export function PnlTable({ rows }: { rows: ChannelPnlRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<ChannelId | "">("");
  const [group, setGroup] = useState("");

  const productGroups = [...new Set(rows.map((r) => r.productGroup))];

  const filteredRows = rows.filter((r) => !channel || r.channel === channel);
  const rollups = rollupByProductGroup(filteredRows).filter(
    (g) => !group || g.productGroup === group,
  );

  const isFiltered = Boolean(channel || group);

  function toggle(productGroup: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(productGroup)) next.delete(productGroup);
      else next.add(productGroup);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-surface p-3">
        <FilterField label="Product group">
          <FilterSelect
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            options={[
              { value: "", label: "All product groups" },
              ...productGroups.map((g) => ({ value: g, label: g })),
            ]}
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
              setGroup("");
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
          {rollups.length === 0 ? (
            <EmptyRow colSpan={COLUMN_COUNT}>No product groups match those filters.</EmptyRow>
          ) : (
            rollups.map((rollup) => (
              <GroupRows
                key={rollup.productGroup}
                rollup={rollup}
                expanded={expanded.has(rollup.productGroup)}
                onToggle={() => toggle(rollup.productGroup)}
              />
            ))
          )}
        </tbody>
      </TableFrame>
    </div>
  );
}

function GroupRows({
  rollup,
  expanded,
  onToggle,
}: {
  rollup: GroupRollup;
  expanded: boolean;
  onToggle: () => void;
}) {
  const canExpand = rollup.channels.length > 1;

  return (
    <>
      <tr className={canExpand ? "cursor-pointer hover:bg-primary-600/[0.04]" : ""} onClick={canExpand ? onToggle : undefined}>
        <Td className="font-medium">
          <span className="flex items-center gap-1.5">
            {canExpand ? (
              <span
                aria-hidden
                className={`text-[10px] text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
              >
                ▶
              </span>
            ) : (
              <span className="w-2.5" aria-hidden />
            )}
            {rollup.productGroup}
          </span>
        </Td>
        <Td>
          {rollup.channels.length === 1 ? (
            <ChannelBadge channel={rollup.channels[0]} />
          ) : (
            <span className="flex gap-1">
              {rollup.channels.map((c) => (
                <ChannelBadge key={c} channel={c} />
              ))}
            </span>
          )}
        </Td>
        <Td align="right">{formatMoney(rollup.revenue, "INR")}</Td>
        <Td align="right">{formatNumber(rollup.units)}</Td>
        <Td align="right">{moneyOrDash(rollup.amazonFees)}</Td>
        <Td align="right">{moneyOrDash(rollup.shopifyFees)}</Td>
        <Td align="right">
          {formatMoney(rollup.shippingCost, "INR")}
          {rollup.shippingCostBasis !== "actual" ? (
            <EstimatedMark mixed={rollup.shippingCostBasis === "mixed"} />
          ) : null}
        </Td>
        <Td align="right">
          <ComingSoon />
        </Td>
        <Td align="right">
          <MarginValue pct={rollup.grossMarginPct} />
        </Td>
        <Td align="right">
          <ComingSoon />
        </Td>
        <Td align="right">
          <BuyBoxCell pct={rollup.buyBoxWinPct} />
        </Td>
      </tr>

      {expanded
        ? rollup.rows.map((row) => (
            <tr key={row.sku} className="bg-surface/60">
              <Td className="pl-8 text-muted">{row.title}</Td>
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
          ))
        : null}
    </>
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

function EstimatedMark({ mixed = false }: { mixed?: boolean }) {
  return (
    <span
      className="ml-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-warn-ink"
      title={
        mixed
          ? "One channel's shipping cost is a manual estimate, the other an actual."
          : "No WMS connected — this is Jordan's own manual per-SKU estimate, not an actual."
      }
    >
      est.
    </span>
  );
}
