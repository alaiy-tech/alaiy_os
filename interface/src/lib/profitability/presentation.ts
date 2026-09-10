import type { ChannelPnlRow } from "./types";

/**
 * The Buy Box heuristic — client-safe, like the equivalent files for Support
 * and Ratings.
 *
 * **No margin maths here any more, and no roll-up.** The per-row margin
 * arrives from the backend, which is the only place that knows whether a fee
 * was settled or quoted and therefore whether a margin can honestly be stated
 * at all; and the product-group roll-up went with the grouping itself, which
 * decided two channels' listings were one product from a barcode match or a
 * title score. A rolled-up margin built on a wrong pairing is a wrong number
 * with nothing on screen to reveal it.
 */

/** V1's floor-safe starting point — a heuristic to flag, never to act on
 *  automatically. Nothing in this app changes a price. */
export const BUYBOX_UNDERCUT = 5;

/** Below this, a SKU is worth a line in the Buy Box panel rather than a
 *  quiet "you're winning" note. */
export const BUYBOX_ATTENTION_THRESHOLD = 75;

/** A week-on-week fall worth calling out beside the win rate. */
export const BUYBOX_DROP_THRESHOLD = 10;

export function totalFees(row: ChannelPnlRow): number {
  return (
    row.amazon_referral_fee +
    row.amazon_fba_fee +
    row.amazon_other_fee +
    row.shopify_transaction_fee
  );
}

export function recommendedPrice(buyBoxPrice: number): number {
  return Math.max(0, buyBoxPrice - BUYBOX_UNDERCUT);
}

/**
 * A win rate low enough to be worth a look — not the price gap alone.
 *
 * Winning most Buy Box impressions a few rupees above the competitor is
 * normal: fulfilment speed and seller rating count too. It is the *rate* that
 * says whether that gap is actually costing sales.
 */
export function needsPricingAttention(row: ChannelPnlRow): boolean {
  if (row.buy_box_win_pct === null) return false;
  return row.buy_box_win_pct < BUYBOX_ATTENTION_THRESHOLD;
}

/** A meaningful week-on-week fall in Buy Box share, or null if there is no
 *  prior reading to compare against. */
export function buyBoxDrop(row: ChannelPnlRow): number | null {
  if (row.buy_box_win_pct === null || row.buy_box_win_pct_prior === null) return null;
  const drop = row.buy_box_win_pct_prior - row.buy_box_win_pct;
  return drop >= BUYBOX_DROP_THRESHOLD ? drop : null;
}
