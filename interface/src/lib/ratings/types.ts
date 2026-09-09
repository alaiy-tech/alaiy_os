import type { ChannelId } from "@/lib/backend/types";

/**
 * The Ratings tab's own shapes.
 *
 * Like Support, there is no backend module behind these — see the issue's
 * open question: Amazon's SP-API has no endpoint for product review *text*,
 * only seller feedback. Shopify's review text comes from whichever review
 * app a seller runs (Judge.me, Yotpo, …), which is not integrated yet
 * either. `mock-data.ts` stands in for both until a data source is chosen.
 */

export type ProductRef = { sku: string; title: string };

/**
 * Amazon keeps these genuinely separate — seller feedback affects the seller
 * rating and Account Health, product reviews affect listing quality — and
 * the issue is explicit that the UI must not blur them. `seller_feedback`
 * has no `product`, because it is not about one.
 */
export type ReviewKind = "product_review" | "seller_feedback";

export type Review = {
  id: string;
  channel: ChannelId;
  kind: ReviewKind;
  /** Absent for Amazon seller feedback, which is not about a product. */
  product?: ProductRef;
  /** 1–5. */
  rating: number;
  date: string;
  snippet: string;
  /** The AI theme tag — a keyword cluster, not a sentiment score (out of
   *  scope per the issue). Absent when nothing in the watchlist matched. */
  themeTag?: string;
  externalUrl?: string;
};

export type SellerRatingPoint = { date: string; value: number };

export type SellerRating = {
  current: number;
  /** Roughly the last 30 days, sampled every few days rather than daily. */
  history: SellerRatingPoint[];
  /** Amazon's own Buy Box eligibility cutoff. */
  threshold: number;
};

/** A detected keyword cluster — "3 reviews this week mention 'zipper'". */
export type PatternAlert = {
  id: string;
  channel: ChannelId;
  product: ProductRef;
  keyword: string;
  count: number;
  windowDays: number;
  severity: "alert" | "warn";
};

export type ProductRatingRow = {
  product: ProductRef;
  channel: ChannelId;
  avgRating: number;
  reviewCount: number;
  /** Null when there is not enough history before the current window to
   *  compare against — a product with three reviews has no trend yet. */
  previousAvgRating: number | null;
};

/** A noted improvement, optionally traced to a logged ops event. */
export type PositiveAttribution = {
  id: string;
  product: ProductRef;
  channel: ChannelId;
  from: number;
  to: number;
  windowDays: number;
  opsNoteId?: string;
};

export type OpsNoteCategory = "packaging" | "supplier" | "logistics" | "other";

/**
 * The one manual-entry mechanism this tab needs. Per the issue: "AI linking
 * 'rating improved after packaging change' requires Jordan to have logged a
 * business event" — reviews themselves are read-only, synced data, but there
 * is nothing to sync a packaging change or a supplier switch from.
 */
export type OpsNote = {
  id: string;
  date: string;
  category: OpsNoteCategory;
  note: string;
  product?: ProductRef;
};
