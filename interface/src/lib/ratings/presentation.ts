import { daysBetween, withinDays } from "@/lib/dates";
import type {
  OpsNoteCategory,
  PatternAlert,
  ProductRatingRow,
  Review,
} from "./types";

/**
 * How a review pattern reads: the fixed keyword watchlist patterns are
 * detected against, the ops note taxonomy, and the rating-change delta —
 * client-safe, like `lib/orders/flags.ts` and `lib/support/cases.ts`.
 */

/** Amazon's own cutoff below which Buy Box eligibility is at risk. */
export const RATING_THRESHOLD = 4.0;

export const OPS_CATEGORY_OPTIONS: { value: OpsNoteCategory; label: string }[] = [
  { value: "packaging", label: "Packaging change" },
  { value: "supplier", label: "Supplier switch" },
  { value: "logistics", label: "3PL / logistics change" },
  { value: "other", label: "Other" },
];

const OPS_CATEGORY_LABEL = new Map(OPS_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

export function opsCategoryLabel(category: OpsNoteCategory): string {
  return OPS_CATEGORY_LABEL.get(category) ?? category;
}

/**
 * A small watchlist rather than free-text mining — sentiment scoring and
 * general theme extraction are explicitly out of scope for V1. Grouped by
 * canonical tag, so "the zipper broke" and "zip came off" both read as the
 * same part failing — which is what turns unrelated-looking complaints into
 * one batch-defect signal instead of three near-misses that never cluster.
 *
 * `defect` marks the tags a physical fault, worth clustering into an alert.
 * The rest — delivery, packaging, value — are still worth a table column
 * ("what is this review actually about?"), but are exactly the fulfilment
 * complaints the issue's third example says must *not* read as a defect.
 */
const THEME_GROUPS: { tag: string; patterns: string[]; defect: boolean }[] = [
  { tag: "zipper", patterns: ["zipper", "zip broke", "zip came"], defect: true },
  { tag: "stitching", patterns: ["stitching", "seam"], defect: true },
  { tag: "strap", patterns: ["strap"], defect: true },
  { tag: "handle", patterns: ["handle"], defect: true },
  { tag: "buckle", patterns: ["buckle"], defect: true },
  { tag: "delivery", patterns: ["shipping", "delivery", "arrived", "delayed", "took "], defect: false },
  { tag: "packaging", patterns: ["box", "packaging", "packed"], defect: false },
  { tag: "quality", patterns: ["quality", "material", "well made", "sturdy"], defect: false },
  { tag: "value", patterns: ["price", "worth the", "great value"], defect: false },
];

const DEFECT_TAGS = new Set(THEME_GROUPS.filter((g) => g.defect).map((g) => g.tag));

export function themeTagFor(snippet: string): string | undefined {
  const lower = snippet.toLowerCase();
  return THEME_GROUPS.find((group) => group.patterns.some((pattern) => lower.includes(pattern)))?.tag;
}

export type RatingDelta = { label: string; direction: "up" | "down" | "flat" };

export function ratingDelta(from: number, to: number): RatingDelta {
  const change = to - from;
  if (Math.abs(change) < 0.05) return { label: "no change", direction: "flat" };
  const sign = change > 0 ? "+" : "−";
  return { label: `${sign}${Math.abs(change).toFixed(1)}`, direction: change > 0 ? "up" : "down" };
}

/**
 * The AI pattern summary banner's own logic: low-star product reviews (never
 * seller feedback — Amazon's does not name a product, and is not what a
 * batch-defect signal is about), grouped by product and keyword, inside a
 * rolling window. Three or more is the line the issue's own example draws.
 */
export function detectDefectPatterns(
  reviews: Review[],
  today = new Date(),
  windowDays = 14,
  minCount = 3,
): PatternAlert[] {
  const groups = new Map<
    string,
    { channel: Review["channel"]; product: NonNullable<Review["product"]>; keyword: string; count: number }
  >();

  for (const review of reviews) {
    if (review.kind !== "product_review" || !review.product) continue;
    if (review.rating > 2) continue;
    if (!withinDays(review.date, today, windowDays)) continue;
    if (!review.themeTag || !DEFECT_TAGS.has(review.themeTag)) continue;

    const key = `${review.channel}:${review.product.sku}:${review.themeTag}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        channel: review.channel,
        product: review.product,
        keyword: review.themeTag,
        count: 1,
      });
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.count >= minCount)
    .map(([key, group]) => ({
      id: key,
      channel: group.channel,
      product: group.product,
      keyword: group.keyword,
      count: group.count,
      windowDays,
      severity: group.count >= minCount + 1 ? "alert" : "warn",
    }));
}

/**
 * Average rating per (product, channel) over the last 30 days, against the
 * 31–90-day-old reviews as the baseline — the same "current vs previous
 * window" shape as the Home tiles, so the breakdown table can show a trend
 * rather than a bare average. `avgRating` falls back to the older window
 * when there is nothing recent, so a product that has gone quiet still shows
 * a number rather than nothing.
 */
export function productBreakdown(reviews: Review[], today = new Date()): ProductRatingRow[] {
  const groups = new Map<
    string,
    { product: NonNullable<Review["product"]>; channel: Review["channel"]; recent: number[]; prior: number[] }
  >();

  for (const review of reviews) {
    if (review.kind !== "product_review" || !review.product) continue;
    const key = `${review.channel}:${review.product.sku}`;
    const existing = groups.get(key) ?? {
      product: review.product,
      channel: review.channel,
      recent: [] as number[],
      prior: [] as number[],
    };
    const age = daysBetween(review.date, today);
    if (age <= 30) existing.recent.push(review.rating);
    else if (age <= 90) existing.prior.push(review.rating);
    groups.set(key, existing);
  }

  const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

  return [...groups.values()]
    .map((group) => ({
      product: group.product,
      channel: group.channel,
      avgRating: average(group.recent.length ? group.recent : group.prior),
      reviewCount: group.recent.length + group.prior.length,
      previousAvgRating: group.prior.length ? average(group.prior) : null,
    }))
    .sort((a, b) => a.avgRating - b.avgRating);
}
