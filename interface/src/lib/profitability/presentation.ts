import type { ChannelId } from "@/lib/backend/types";
import type { ChannelPnlRow, FeeBasis } from "./types";

/**
 * P&L math and the Buy Box heuristic — client-safe, like the equivalent
 * files for Support, Ratings and Shipping.
 */

/** V1's floor-safe starting point — a heuristic to flag, never to act on
 *  automatically. See the issue's key decision. */
export const BUYBOX_UNDERCUT = 5;

/** Below this, a SKU is worth a line in the Buy Box panel rather than a
 *  quiet "you're winning" note. */
export const BUYBOX_ATTENTION_THRESHOLD = 75;

export function totalFees(row: ChannelPnlRow): number {
  return row.amazonReferralFee + row.amazonFbaFee + row.shopifyTransactionFee;
}

/**
 * Revenue minus fees minus shipping, over revenue — everything V1 can
 * measure without COGS. Not the same claim as a textbook "gross margin"
 * once COGS exists; see `types.ts` on why `netMarginPct` is null instead of
 * a second copy of this number.
 */
export function grossMarginPct(row: { revenue: number; shippingCost: number }, fees: number): number {
  if (row.revenue <= 0) return 0;
  return ((row.revenue - fees - row.shippingCost) / row.revenue) * 100;
}

export type GroupRollup = {
  productGroup: string;
  channels: ChannelId[];
  revenue: number;
  units: number;
  amazonFees: number;
  shopifyFees: number;
  shippingCost: number;
  feeBasis: FeeBasis | "mixed";
  shippingCostBasis: FeeBasis | "mixed";
  grossMarginPct: number;
  /** From the group's one Amazon row, if it has one — never averaged across
   *  more than one, because this mock never puts two Amazon listings under
   *  the same group. */
  buyBoxWinPct: number | null;
  rows: ChannelPnlRow[];
};

function agreeOr<T extends string>(values: T[], mixed: "mixed"): T | "mixed" {
  return values.every((v) => v === values[0]) ? values[0] : mixed;
}

/** Product-group rows, each rolling up its channel-level rows — the P&L
 *  table's collapsed view. Expanding a group is just choosing to render
 *  `rows` instead of trusting these totals. */
export function rollupByProductGroup(rows: ChannelPnlRow[]): GroupRollup[] {
  const groups = new Map<string, ChannelPnlRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.productGroup) ?? [];
    existing.push(row);
    groups.set(row.productGroup, existing);
  }

  return [...groups.entries()].map(([productGroup, groupRows]) => {
    const revenue = groupRows.reduce((sum, r) => sum + r.revenue, 0);
    const units = groupRows.reduce((sum, r) => sum + r.units, 0);
    const amazonFees = groupRows.reduce((sum, r) => sum + r.amazonReferralFee + r.amazonFbaFee, 0);
    const shopifyFees = groupRows.reduce((sum, r) => sum + r.shopifyTransactionFee, 0);
    const shippingCost = groupRows.reduce((sum, r) => sum + r.shippingCost, 0);
    const fees = amazonFees + shopifyFees;
    const amazonRow = groupRows.find((r) => r.channel === "amazon" && r.buyBoxWinPct !== null);

    return {
      productGroup,
      channels: groupRows.map((r) => r.channel),
      revenue,
      units,
      amazonFees,
      shopifyFees,
      shippingCost,
      feeBasis: agreeOr(groupRows.map((r) => r.feeBasis), "mixed"),
      shippingCostBasis: agreeOr(groupRows.map((r) => r.shippingCostBasis), "mixed"),
      grossMarginPct: grossMarginPct({ revenue, shippingCost }, fees),
      buyBoxWinPct: amazonRow?.buyBoxWinPct ?? null,
      rows: groupRows,
    };
  });
}

export function recommendedPrice(buyBoxPrice: number): number {
  return Math.max(0, buyBoxPrice - BUYBOX_UNDERCUT);
}

/**
 * A win rate low enough to be worth a look — not the price gap alone.
 * Winning most Buy Box impressions a few rupees above the competitor is
 * normal (fulfilment speed and ratings count too); it is the *rate* that
 * says whether that gap is actually costing sales.
 */
export function needsPricingAttention(row: ChannelPnlRow): boolean {
  if (row.buyBoxWinPct === null) return false;
  return row.buyBoxWinPct < BUYBOX_ATTENTION_THRESHOLD;
}
