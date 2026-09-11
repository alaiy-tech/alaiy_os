import type { ReviewTopic, TopicSentiment } from "./types";

/**
 * How a rating change and a topic read — client-safe, so the tab can filter
 * and regroup without another round trip.
 *
 * **What used to be here and is gone:** a keyword watchlist that scanned review
 * text for "zipper", "stitching", "strap" and clustered the matches into a
 * batch-defect alert. It matched against text SP-API does not return and never
 * will, so nothing could ever have fed it. Amazon's own topic aggregate does
 * the same job with less confidence and actual data behind it — see `concerns`
 * on the backend.
 */

/** Amazon's own cutoff below which Buy Box eligibility is at risk. Also
 *  returned on the seller rating; this is the fallback for rendering the line
 *  before that has loaded. */
export const RATING_THRESHOLD = 4.0;

/** Below this much movement a rating change is as likely to be Amazon's
 *  rounding as a real shift. Matches RATING_DELTA_FLOOR on the backend. */
export const RATING_DELTA_FLOOR = 0.1;

export type RatingDelta = { label: string; direction: "up" | "down" | "flat" };

export function ratingDelta(from: number, to: number): RatingDelta {
  const change = to - from;
  if (Math.abs(change) < RATING_DELTA_FLOOR) return { label: "no change", direction: "flat" };
  const sign = change > 0 ? "+" : "−";
  return {
    label: `${sign}${Math.abs(change).toFixed(1)}`,
    direction: change > 0 ? "up" : "down",
  };
}

export const SENTIMENT_TONE: Record<TopicSentiment, string> = {
  positive: "border-ok/30 bg-ok-soft text-ok-ink",
  neutral: "border-line bg-surface text-muted",
  negative: "border-alert/30 bg-alert-soft text-alert-ink",
};

/**
 * Amazon's mention share as a phrase, or nothing.
 *
 * Deliberately vague where the data is vague. Amazon gives a proportion of
 * mentions and no total, so "raised often" is as precise as this can honestly
 * get — turning 0.31 into "about 12 reviews" would invent the denominator.
 */
export function mentionPhrase(share: number | null): string | null {
  if (share === null) return null;
  // Amazon has shipped this as both a fraction and a percentage. Reading a
  // value above 1 as a fraction would call a 31% share "rarely raised".
  const fraction = share > 1 ? share / 100 : share;
  if (fraction >= 0.3) return "raised often";
  if (fraction >= 0.1) return "raised regularly";
  return "raised occasionally";
}

export type TopicGroup = {
  sku: string;
  title: string;
  /** This SKU in Seller Central. Taken from the group's first topic — they are
   *  all the same product. */
  admin_url: string | null;
  topics: ReviewTopic[];
};

/** Topics grouped by product, each product's own list already in Amazon's
 *  rank order — the per-product breakdown the tab draws under the banner. */
export function topicsByProduct(topics: ReviewTopic[]): TopicGroup[] {
  const groups = new Map<string, TopicGroup>();
  for (const topic of topics) {
    const existing = groups.get(topic.sku) ?? {
      sku: topic.sku,
      title: topic.title,
      // Every topic in a group is the same SKU, so they all carry the same
      // link; the group takes the first one rather than repeating it on each
      // chip, which would put a row of identical marks under one heading.
      admin_url: topic.admin_url,
      topics: [],
    };
    existing.topics.push(topic);
    groups.set(topic.sku, existing);
  }
  // Products with something negative said about them first — that is what
  // someone opened this tab to find.
  return [...groups.values()].sort((a, b) => {
    const negatives = (g: (typeof a)["topics"]) => g.filter((t) => t.sentiment === "negative").length;
    return negatives(b.topics) - negatives(a.topics);
  });
}
