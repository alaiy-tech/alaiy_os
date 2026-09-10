import type { ChannelPnlRow } from "./types";

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
