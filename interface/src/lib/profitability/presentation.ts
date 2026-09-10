import type { ChannelId } from "@/lib/backend/types";
import type { ChannelPnlRow, FeeBasis } from "./types";

/**
 * The roll-up and the Buy Box heuristic — client-safe, so the table can
 * regroup as filters change without another round trip.
 *
 * The per-row margin is *not* computed here. It arrives from the backend,
 * which is the only place that knows whether a fee was settled or quoted and
 * therefore whether a margin can honestly be stated at all. What is computed
 * here is the group roll-up, because a group is whatever the current filters
 * left in it.
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

export type GroupRollup = {
  product_group: string;
  channels: ChannelId[];
  revenue: number;
  units: number;
  amazonFees: number;
  shopifyFees: number;
  fee_basis: FeeBasis | "mixed";
  /**
   * True only when every row in the group has fees. One SKU with unknown fees
   * makes the group's margin unknowable: adding a known fee to an unknown one
   * and dividing produces a number that is wrong in the flattering direction,
   * and nothing on screen would reveal it.
   */
  fees_available: boolean;
  gross_margin_pct: number | null;
  /** From the group's Amazon rows. Averaged across them weighted by units,
   *  because two listings under one group can hold the Buy Box at different
   *  rates and the unweighted mean would let a SKU that sold twice count as
   *  much as one that sold two hundred. */
  buy_box_win_pct: number | null;
  rows: ChannelPnlRow[];
};

function agreeOr<T extends string>(values: T[], mixed: "mixed"): T | "mixed" {
  if (values.length === 0) return mixed;
  return values.every((v) => v === values[0]) ? values[0] : mixed;
}

function weightedBuyBox(rows: ChannelPnlRow[]): number | null {
  const rated = rows.filter((r) => r.buy_box_win_pct !== null);
  if (rated.length === 0) return null;
  // Units can be zero across the group if every rated SKU sold nothing in the
  // window; fall back to the plain mean rather than dividing by zero.
  const weight = rated.reduce((sum, r) => sum + r.units, 0);
  if (weight <= 0) {
    return rated.reduce((sum, r) => sum + (r.buy_box_win_pct ?? 0), 0) / rated.length;
  }
  return (
    rated.reduce((sum, r) => sum + (r.buy_box_win_pct ?? 0) * r.units, 0) / weight
  );
}

/**
 * Product-group rows, each rolling up its channel-level rows.
 *
 * Expanding a group is choosing to render `rows` instead of trusting these
 * totals, so the two must be the same arithmetic — which is why the group's
 * margin is recomputed from summed revenue and summed fees rather than
 * averaging the rows' own percentages. Averaging percentages would weight a
 * SKU that sold three units the same as one that sold three hundred.
 */
export function rollupByProductGroup(rows: ChannelPnlRow[]): GroupRollup[] {
  const groups = new Map<string, ChannelPnlRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.product_group) ?? [];
    existing.push(row);
    groups.set(row.product_group, existing);
  }

  return [...groups.entries()].map(([product_group, groupRows]) => {
    const revenue = groupRows.reduce((sum, r) => sum + r.revenue, 0);
    const units = groupRows.reduce((sum, r) => sum + r.units, 0);
    const amazonFees = groupRows.reduce(
      (sum, r) => sum + r.amazon_referral_fee + r.amazon_fba_fee + r.amazon_other_fee,
      0,
    );
    const shopifyFees = groupRows.reduce((sum, r) => sum + r.shopify_transaction_fee, 0);
    const feesAvailable = groupRows.every((r) => r.fees_available);

    return {
      product_group,
      // Deduped: two Amazon SKUs under one group should show one Amazon badge.
      channels: [...new Set(groupRows.map((r) => r.channel))],
      revenue,
      units,
      amazonFees,
      shopifyFees,
      fee_basis: agreeOr(
        groupRows.filter((r) => r.fees_available).map((r) => r.fee_basis),
        "mixed",
      ),
      fees_available: feesAvailable,
      gross_margin_pct:
        feesAvailable && revenue > 0
          ? ((revenue - amazonFees - shopifyFees) / revenue) * 100
          : null,
      buy_box_win_pct: weightedBuyBox(groupRows),
      rows: groupRows,
    };
  });
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
