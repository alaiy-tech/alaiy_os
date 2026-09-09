import Link from "next/link";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import {
  canExpand,
  headroomLabel,
  metricStatusLabel,
  metricTone,
  type HealthTone,
} from "@/lib/health/status";
import type { HealthMetric } from "@/lib/backend/types";
import type { LinkProps } from "next/link";

/**
 * The metric tiles: current value, Amazon's limit, and the room between them.
 *
 * The room is the tile's reason to exist. Seller Central shows the same
 * percentages; what it does not say is "0.3pp below the limit", which is the
 * difference between a number a seller reads and a number a seller acts on.
 *
 * The spec's four come first and are drawn large. The other three Amazon
 * reports are shown below them at a smaller size rather than dropped — a
 * seller whose On-Time Delivery Rate is sliding wants to know, and hiding a
 * metric that can get an account suspended would be a strange kindness.
 *
 * A tile that can name the orders behind it is a link; one that cannot is not.
 * Offering an expander that resolves to "we can't tell you which orders" is
 * worse than offering nothing — see CONTRIBUTING in the backend.
 */

const TONES: Record<HealthTone, { card: string; ink: string; dot: string }> = {
  ok: { card: "border-ok/30", ink: "text-ok-ink", dot: "bg-ok" },
  warn: { card: "border-warn/40", ink: "text-warn-ink", dot: "bg-warn" },
  alert: { card: "border-alert/40", ink: "text-alert-ink", dot: "bg-alert" },
  neutral: { card: "border-line", ink: "text-muted", dot: "bg-muted/50" },
};

export function MetricTiles({
  metrics,
  hrefFor,
  expanded,
}: {
  metrics: HealthMetric[];
  /** Built by the page from its own query, so this knows no routes. */
  hrefFor: (metricKey: string | undefined) => LinkProps["href"];
  expanded?: string;
}) {
  const primary = metrics.filter((m) => m.primary);
  const secondary = metrics.filter((m) => !m.primary);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primary.map((metric) => (
          <Tile
            key={metric.metric_key}
            metric={metric}
            hrefFor={hrefFor}
            expanded={expanded === metric.metric_key}
          />
        ))}
      </div>

      {secondary.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {secondary.map((metric) => (
            <SmallTile key={metric.metric_key} metric={metric} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Tile({
  metric,
  hrefFor,
  expanded,
}: {
  metric: HealthMetric;
  hrefFor: (metricKey: string | undefined) => LinkProps["href"];
  expanded: boolean;
}) {
  const tone = TONES[metricTone(metric.health_status)];
  const headroom = headroomLabel(metric);
  const clickable = canExpand(metric);

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          {metric.metric_label}
        </h3>
        <span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      </div>

      <p className="pt-2 font-data text-[27px] font-semibold leading-none tracking-tight text-primary-600 tabular-nums">
        {formatPercent(metric.metric_value)}
      </p>

      {/* The limit, always, even on a healthy metric. A percentage with no
          threshold beside it is the number Seller Central already shows. */}
      <p className="pt-2 text-[12px] text-muted">
        Amazon&rsquo;s limit{" "}
        <span className="font-data tabular-nums">
          {metric.higher_is_better ? "≥ " : "≤ "}
          {formatPercent(metric.metric_target)}
        </span>
      </p>

      <p className={`pt-1 text-[12px] font-medium ${tone.ink}`}>
        {/* The status is spelled out, so the dot and the colour are never the
            only way to read the tile. */}
        {headroom ?? metricStatusLabel(metric.health_status)}
      </p>

      {clickable ? (
        <p className="pt-2 text-[11.5px] text-muted-soft">
          {expanded ? "Hide the orders behind this ↑" : "Which orders? →"}
        </p>
      ) : null}
    </>
  );

  const shell = `rounded-sm border bg-white px-4 py-3.5 ${tone.card} ${
    expanded ? "ring-1 ring-highlight-600" : ""
  }`;

  if (!clickable) {
    return (
      <article className={shell} title={asOfTitle(metric)}>
        {body}
      </article>
    );
  }

  return (
    <Link
      href={hrefFor(expanded ? undefined : metric.metric_key)}
      aria-expanded={expanded}
      title={asOfTitle(metric)}
      className={`${shell} block transition-colors hover:border-primary-600/40`}
    >
      {body}
    </Link>
  );
}

/** The three Amazon reports beyond the spec's four. Same facts, less room. */
function SmallTile({ metric }: { metric: HealthMetric }) {
  const tone = TONES[metricTone(metric.health_status)];
  const headroom = headroomLabel(metric);

  return (
    <article
      className={`flex items-baseline justify-between gap-3 rounded-sm border bg-white px-3.5 py-2.5 ${tone.card}`}
      title={asOfTitle(metric)}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-muted">{metric.metric_label}</span>
        <span className={`text-[11.5px] ${tone.ink}`}>
          {headroom ?? metricStatusLabel(metric.health_status)}
        </span>
      </span>
      <span className="shrink-0 font-data text-[16px] font-semibold text-primary-600 tabular-nums">
        {formatPercent(metric.metric_value)}
      </span>
    </article>
  );
}

/**
 * The tooltip: when this reading is from, and what ODR is made of.
 *
 * The date matters because Amazon rebuilds these once a day — a seller acting
 * at 4pm on a figure read at 6am should be able to find that out.
 */
function asOfTitle(metric: HealthMetric): string {
  const parts = [`Read from Amazon's performance report on ${formatDate(metric.as_of_date)}.`];

  if (metric.metric_value === null) {
    parts.push("Amazon did not report this metric — which is not the same as zero.");
  }
  if (metric.defect_guarantees !== null || metric.defect_chargebacks !== null) {
    parts.push(
      `Includes ${formatNumber(metric.defect_guarantees)} A-to-Z claims and ` +
        `${formatNumber(metric.defect_chargebacks)} chargebacks in the last 30 days.`,
    );
  }
  return parts.join(" ");
}
