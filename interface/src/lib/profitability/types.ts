import type { ChannelId } from "@/lib/backend/types";

/**
 * The Profitability tab's own shapes.
 *
 * Every fee and cost field here already exists via a real SP-API or Shopify
 * endpoint (Fees API, Financial Events API, Competitive Pricing API, Shopify
 * orders) — nothing is blocked the way Support's or Ratings' data is. The
 * one field V1 genuinely cannot fill in is COGS, which the issue is explicit
 * about: the column exists, is visible, and says "Coming soon" rather than
 * being hidden — see the issue's key decision against an averaged COGS
 * field. `grossMarginPct` below is therefore *before* COGS by construction,
 * and `netMarginPct` is the one that needs it and is null until it exists.
 */

export type FeeBasis = "actual" | "estimated";

/**
 * One product, on one channel — the grain a P&L row is computed at. A
 * product sold on both Amazon and Shopify is two of these, because the fee
 * structure, the price, and the margin genuinely differ per channel; the
 * table's Product Group row is these rolled up, not a third copy of the
 * numbers.
 */
export type ChannelPnlRow = {
  sku: string;
  title: string;
  /** The row groups under — several SKUs (a size or colour) can share one. */
  productGroup: string;
  channel: ChannelId;
  revenue: number;
  units: number;
  amazonReferralFee: number;
  /** Amazon's fulfilment fee. 0 off Amazon — this mock assumes every Amazon
   *  row is FBA-fulfilled, which is also why `shippingCost` is 0 for them:
   *  Amazon's own fee already covers pick, pack and ship. */
  amazonFbaFee: number;
  shopifyTransactionFee: number;
  /** Financial Events (settled) vs. Fee Preview (recent, unsettled) — see
   *  the issue's key decision. The UI must not present an estimate as if it
   *  were an actual. */
  feeBasis: FeeBasis;
  shippingCost: number;
  /** From a connected WMS, or Jordan's own manual per-SKU estimate — the V1
   *  fallback the issue calls out, which must read as an estimate. */
  shippingCostBasis: FeeBasis;
  /** Null off Amazon — Shopify has no Buy Box. */
  buyBoxWinPct: number | null;
  buyBoxWinPctSevenDaysAgo: number | null;
  currentPrice: number | null;
  buyBoxPrice: number | null;
  /**
   * What recommending a price would project to recover — the kind of
   * forecast a real elasticity model would produce from sales velocity at
   * different price points. There is no such model here, so this is filled
   * in by hand on the one row with a recommendation worth showing, exactly
   * like Ratings' hand-authored positive-attribution figures; the
   * *recommended price itself* is never hand-authored — see
   * `recommendedPrice` in presentation.ts.
   */
  projectedBuyBoxRecoveryPct?: number;
  projectedMonthlyRevenueImpact?: number;
};
