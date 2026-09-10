import type { ChannelId } from "@/lib/backend/types";

/**
 * The Profitability tab's shapes, as `api/profitability.py` returns them.
 *
 * Snake case, like every other backend-shaped type in this app — these cross
 * the wire as-is rather than through a renaming layer that would have to be
 * kept in step with the Python.
 *
 * Two fields carry the whole honesty of this tab and neither is decoration:
 * `fee_basis` says whether the fees are Amazon's own accounting or its quote,
 * and `fees_available` says whether there are any. See the module docstring on
 * `selfserve/profitability.py` — the failure this guards against is presenting
 * an estimate as an actual, which a seller cannot detect for themselves and
 * will price against.
 */

/**
 * Where a fee figure came from.
 *
 * `actual` means settled fees covered every unit sold in the window — Amazon's
 * own ledger, nothing estimated. `estimated` means anything else, including a
 * row that is mostly settled with a quoted tail: Amazon settles two to four
 * weeks after a sale, so a recent window is normally part-estimated, and
 * labelling that blend "actual" because most of it is would be the exact
 * failure above.
 */
export type FeeBasis = "actual" | "estimated";

/**
 * One product, on one channel — the grain a P&L row is computed at.
 *
 * A product sold on both Amazon and Shopify is two of these, because the fee
 * structure, the price and therefore the margin genuinely differ per channel.
 * The table's product-group row is these rolled up, not a third copy of the
 * numbers.
 */
export type ChannelPnlRow = {
  sku: string;
  title: string;
  /** The row groups under — several SKUs (a size or colour) can share one.
   *  Falls back to the SKU's own title when the product grouping has not
   *  paired it with anything, so an ungrouped product rolls up under itself
   *  rather than into one bucket with every other ungrouped product. */
  product_group: string;
  channel: ChannelId;
  revenue: number;
  units: number;
  orders: number;
  currency: string | null;
  external_url: string | null;

  amazon_referral_fee: number;
  amazon_fba_fee: number;
  /** Storage, long-term storage, disposal — Amazon's charges that are neither
   *  commission nor fulfilment. Counted, because a margin that omitted them
   *  would be wrong by exactly that much. */
  amazon_other_fee: number;
  shopify_transaction_fee: number;
  fee_basis: FeeBasis;
  /**
   * False when the channel has told us nothing about this SKU's fees — Amazon
   * declined to quote it and has settled nothing, or the Shopify store takes
   * payment through a gateway Shopify never sees.
   *
   * Not the same as zero, and the table must not render it as one: a ₹0 fee
   * makes the SKU with unknown costs look like the best margin on the page.
   */
  fees_available: boolean;
  /** Why, when `fees_available` is false. Shown rather than left as a dash
   *  nobody can act on. */
  fee_note: string | null;
  /** How much of the row is Amazon's accounting and how much is its quote.
   *  What `fee_basis` is derived from, kept so the UI can say "18 of 24 units
   *  settled" instead of just "estimated". */
  settled_units: number;
  estimated_units: number;

  /**
   * Revenue less fees, over revenue. Before COGS and before shipping, neither
   * of which has a source — see the tab's own note.
   *
   * Null when the fees are unknown. A margin computed from a fee we do not
   * have is a guess with a decimal point on it, and the one number on this tab
   * nobody should be allowed to read off a guess.
   */
  gross_margin_pct: number | null;

  /** Null off Amazon — Shopify has no Buy Box. Also null on an Amazon SKU
   *  whose Sales & Traffic report we have not read, which is a role gap
   *  rather than a zero win rate. */
  buy_box_win_pct: number | null;
  /** The freshest reading a week or more old, for the "down from" comparison.
   *  Amazon keeps no Buy Box history, so this exists only because it was
   *  stored on the day it was taken. */
  buy_box_win_pct_prior: number | null;
  /** The date that prior reading is actually from. A sync can miss a day, so
   *  the comparison says when rather than implying a week to the hour. */
  buy_box_prior_date: string | null;
  buy_box_price: number | null;
  buy_box_is_ours: boolean | null;
  buy_box_as_of: string | null;
  current_price: number | null;
};

/**
 * What this seller's numbers are made of, decided on the backend.
 *
 * An empty table means "no Amazon account", "no sales in this window" or "the
 * Finance role was never granted", and those need three different sentences.
 * None of them is derivable from an absence of rows in the browser, so the
 * backend says which it is.
 */
export type PnlCoverage = {
  amazon_connected: boolean;
  shopify_connected: boolean;
  amazon_skus: number;
  shopify_skus: number;
  /** At least one SKU has a settled figure, so the Finance and Accounting role
   *  is granted and the seller is simply inside the settlement lag. */
  has_settled_fees: boolean;
  has_fee_data: boolean;
  has_buy_box: boolean;
  shopify_fees_available: boolean;
  synced_at: string | null;
  /** Both false, and expected to stay so. The columns remain on the tab and
   *  say "coming soon" rather than disappearing: COGS needs lot-level cost per
   *  PO line and a per-SKU shipping cost needs a WMS, and an averaged stand-in
   *  for either would be a number nobody could act on. */
  cogs_available: boolean;
  shipping_cost_available: boolean;
};

export type PnlPage = {
  days: number;
  rows: ChannelPnlRow[];
  coverage: PnlCoverage;
  /** Taken from the rows themselves, not assumed. A seller reading ₹ against
   *  figures Amazon settled in $ has every number on the page wrong by the
   *  exchange rate. */
  currency: string | null;
};
