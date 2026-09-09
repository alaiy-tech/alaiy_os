import type { HealthMetric, HealthStatus } from "@/lib/backend/types";

/**
 * How account health reads.
 *
 * The backend decides *whether* a metric is close to its limit; this decides
 * what the seller is told about it. Same split as `lib/orders/flags.ts` and
 * `lib/dashboard/alerts.ts` — the observation is the backend's, the wording and
 * the colour are ours.
 *
 * Client-safe: the metric tiles are links and the banner is static, but the
 * contributing-orders panel is a client component and shares this vocabulary.
 */

/** The three hues, and never a fourth. Per DESIGN.md, `-ink` carries the words. */
export type HealthTone = "ok" | "warn" | "alert" | "neutral";

const TONES: Record<HealthMetric["health_status"], HealthTone> = {
  ok: "ok",
  warn: "warn",
  critical: "alert",
  unknown: "neutral",
};

export function metricTone(status: HealthMetric["health_status"]): HealthTone {
  return TONES[status] ?? "neutral";
}

/**
 * What a metric's state is called.
 *
 * Spelled out on every tile, so the colour is a way of ranking seven tiles at
 * a glance rather than the only thing saying which one matters.
 */
export function metricStatusLabel(status: HealthMetric["health_status"]): string {
  if (status === "critical") return "Over Amazon's limit";
  if (status === "warn") return "Close to the limit";
  if (status === "ok") return "Within limit";
  return "Not reported";
}

/**
 * The banner.
 *
 * Three real states plus unknown, because the spec is explicit that this is
 * driven by proximity to the thresholds and not merely by whether one has been
 * crossed — "At Risk" is the state that exists to be seen *before* anything
 * breaches, which is the entire point of the tab.
 */
export type BannerPresentation = {
  label: string;
  /** One sentence: what this means, not what the state is called again. */
  blurb: string;
  card: string;
  rule: string;
  ink: string;
};

const BANNERS: Record<HealthStatus, BannerPresentation> = {
  healthy: {
    label: "Healthy",
    blurb: "Every metric Amazon reports is inside its limit, with room to spare.",
    card: "border-ok/30 bg-ok-soft",
    rule: "bg-ok",
    ink: "text-ok-ink",
  },
  at_risk: {
    label: "At risk",
    blurb:
      "Nothing has breached yet, but at least one metric is close enough that a bad week would take it over.",
    card: "border-warn/40 bg-warn-soft",
    rule: "bg-warn",
    ink: "text-warn-ink",
  },
  action_required: {
    label: "Action required",
    blurb:
      "At least one metric is past Amazon's published limit. This is the state accounts get suspended from.",
    card: "border-alert/30 bg-alert-soft",
    rule: "bg-alert",
    ink: "text-alert-ink",
  },
  unknown: {
    label: "Not known yet",
    blurb:
      "Amazon hasn't reported any performance metrics for this account yet, so there is nothing to judge.",
    card: "border-line bg-surface",
    rule: "bg-muted/40",
    ink: "text-muted",
  },
};

export function bannerFor(status: HealthStatus): BannerPresentation {
  return BANNERS[status] ?? BANNERS.unknown;
}

/**
 * A metric's headroom, as a sentence.
 *
 * The backend signs `headroom` the same way on every metric — positive is room
 * to spare — so this never has to know which direction is good. It is the
 * figure the spec asks the tiles for ("0.3% below threshold") and the reason
 * the tab beats reading the same number in Seller Central.
 */
export function headroomLabel(metric: HealthMetric): string | undefined {
  if (metric.headroom === null || metric.metric_value === null) return undefined;
  const points = Math.abs(metric.headroom).toFixed(2).replace(/\.?0+$/, "");
  return metric.headroom >= 0
    ? `${points}pp below the limit`
    : `${points}pp over the limit`;
}

/**
 * Whether a metric's tile is worth expanding.
 *
 * Matches CONTRIBUTING in the backend. Kept here as well so a tile that cannot
 * name its orders is not a link at all — offering an expander that resolves to
 * "we can't tell you" is worse than not offering one.
 */
const EXPANDABLE = new Set(["orderDefectRate", "lateShipmentRate"]);

export function canExpand(metric: HealthMetric): boolean {
  return EXPANDABLE.has(metric.metric_key) && metric.metric_value !== null;
}
