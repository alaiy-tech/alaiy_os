import type { ChannelId, SellerCentralSection } from "@/lib/backend/types";

/**
 * The Ratings tab's shapes, as `api/ratings.py` returns them.
 *
 * Shaped by two absences, and every type here is narrower than it would
 * otherwise be because of one of them:
 *
 *   - **Amazon exposes no product-review text**, at any SP-API version. So
 *     there is no `Review` type with a body: what has text is buyer
 *     *feedback*, which is about the seller, and what is about a product is an
 *     *aggregate* — a topic and a sentiment, nothing quotable.
 *   - **Shopify has no reviews at all.** Not a gap in this integration; the
 *     Admin API has no review resource. Shopify reviews belong to whichever
 *     app a store installed (Judge.me, Yotpo, Loox), none integrated. The
 *     backend reports that as `ChannelSupport` rather than the frontend
 *     hardcoding a sentence, so the day one lands the notice disappears by
 *     itself.
 */

/** Which channels this tab can answer for, and why not, decided on the
 *  backend. */
export type ChannelSupport = {
  channel: ChannelId;
  supported: boolean;
  reason: string | null;
};

/** What the tab cannot tell you, stated where you would look for it — the
 *  same shape Account Health reports its gaps in. */
export type RatingsGap = {
  key: string;
  title: string;
  detail: string;
};

/**
 * The seller rating, computed from stored buyer feedback.
 *
 * Amazon publishes no endpoint for its own figure, so this is the mean of the
 * feedback rows this app holds — at most fifty over ninety days. It will not
 * match Seller Central exactly, and `sample_size`, `window_days` and `basis`
 * are here so the tile can show its working instead of asserting a number
 * Seller Central will contradict.
 */
export type SellerRating = {
  current: number | null;
  history: SellerRatingPoint[];
  /** Amazon's own Buy Box eligibility cutoff. */
  threshold: number;
  sample_size: number;
  window_days: number;
  basis: "feedback_average";
};

export type SellerRatingPoint = {
  date: string;
  value: number;
  /** How many pieces of feedback this point is the mean of. Genuinely small —
   *  shown rather than hidden, so a jagged line reads as thin data instead of
   *  a volatile business. */
  sample_size: number;
};

/**
 * One piece of buyer feedback: the only quotable text on this tab.
 *
 * It is about the *transaction* — did it ship, was it as described — and
 * carries an order id. `products` is what that order contained, which is
 * context and not attribution: an order of three products does not make the
 * complaint about any one of them, so this is never a product the row is filed
 * under.
 */
export type SellerFeedback = {
  id: string;
  channel: ChannelId;
  kind: "seller_feedback";
  /** 1–5. Amazon counts 1 and 2 as negative, which is what feeds Order Defect
   *  Rate. */
  rating: number;
  date: string | null;
  comment: string | null;
  order_id: string;
  order_number: string | null;
  products: string[];
  /** This order in Seller Central. Feedback is about a *transaction*, so the
   *  order is the page that shows what the buyer is talking about — Feedback
   *  Manager has no per-row route to link to. */
  admin_url: string | null;
};

export type TopicSentiment = "positive" | "neutral" | "negative";

/**
 * One topic buyers raise about one product — Amazon's aggregate.
 *
 * `mention_share` is Amazon's own proportion and is never multiplied into a
 * count of reviews: that would read as a number of things someone could go and
 * look at, and there is nothing to look at.
 */
export type ReviewTopic = {
  sku: string;
  asin: string | null;
  title: string;
  channel: ChannelId;
  topic: string;
  sentiment: TopicSentiment;
  /** Amazon's own ranking within its response — the only ordering it vouches
   *  for. */
  rank: number | null;
  mention_share: number | null;
  /** Amazon rebuilds these about weekly, so this reading is up to seven days
   *  old and the tab says so rather than implying this morning. */
  as_of_date: string | null;
  /** This SKU in Seller Central. SKU Central and not the ASIN's detail page:
   *  the ASIN is the product, and this row is read by the seller about to
   *  change their own offer of it. Null on a row with no SKU. */
  admin_url: string | null;
};

/**
 * A product's average review rating and how it moved.
 *
 * `review_count` is always null. Amazon's trend carries an average and no
 * denominator, and deriving one — from mention shares, from order counts —
 * would put a number on screen that nothing produced.
 */
export type ProductRatingRow = {
  sku: string;
  asin: string | null;
  title: string;
  channel: ChannelId;
  avg_rating: number;
  /** Null when there is only one stored reading — a product whose history we
   *  do not have yet has no trend, which is not the same as no change. */
  previous_avg_rating: number | null;
  period_start: string | null;
  period_end: string | null;
  points: number;
  review_count: null;
  /** This SKU in Seller Central — see ReviewTopic.admin_url. */
  admin_url: string | null;
};

/**
 * A product whose rating climbed between two readings.
 *
 * An observation and not a claim about cause. Linking "the rating improved
 * after the packaging change" needs a logged business event, which this app
 * does not store — and inferring a cause from two numbers would be the tab
 * inventing the most flattering explanation available.
 */
export type RatingImprovement = {
  sku: string;
  title: string;
  channel: ChannelId;
  from: number;
  to: number;
  delta: number;
  period_start: string | null;
  period_end: string | null;
  /** This SKU in Seller Central — see ReviewTopic.admin_url. */
  admin_url: string | null;
};

export type RatingsPage = SellerCentralSection & {
  connected: boolean;
  channels: ChannelSupport[];
  gaps: RatingsGap[];
  seller_rating: SellerRating | null;
  feedback: SellerFeedback[];
  topics: ReviewTopic[];
  /** The negative slice of `topics`, worst-ranked first — what replaced a
   *  banner that needed review text to write. */
  concerns: ReviewTopic[];
  products: ProductRatingRow[];
  improvements: RatingImprovement[];
  synced_at: string | null;
  never_synced: boolean;
};
