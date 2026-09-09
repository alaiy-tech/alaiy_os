import { formatDate, formatPercent } from "@/lib/format";
import type { HealthMetric, HealthTrend } from "@/lib/backend/types";

/**
 * The metric trend, as small multiples rather than one chart.
 *
 * The spec asks for "all four metrics over time, with Amazon's threshold line
 * shown as a horizontal reference". One set of axes cannot do that honestly:
 * Order Defect Rate lives near 1% and Valid Tracking Rate near 97%, so a
 * shared y-scale either flattens ODR into the baseline — the metric most
 * likely to suspend an account, drawn as a straight line — or needs a second
 * axis, which makes two series look like they cross when they never touch.
 *
 * So each metric gets its own panel, its own scale, and its own threshold
 * line. The comparison the seller actually wants is not "is ODR above LSR",
 * which is meaningless, but "is each one heading towards its own limit", and
 * four small panels answer that in one glance.
 *
 * No chart library. Four sparklines' worth of `<path>` is less code than the
 * import would be, and it keeps the whole tab server-rendered.
 */

/** Panel geometry, in the SVG's own user units. */
const W = 240;
const H = 72;
const PAD_X = 4;
const PAD_Y = 8;

export function TrendChart({
  trend,
  metrics,
}: {
  trend: HealthTrend;
  /** For the labels and which panels to draw, in the tiles' own order. */
  metrics: HealthMetric[];
}) {
  const byMetric = new Map<string, { date: string; value: number }[]>();
  for (const row of trend.rows) {
    const series = byMetric.get(row.metric_key) ?? [];
    series.push({ date: String(row.as_of_date), value: row.metric_value });
    byMetric.set(row.metric_key, series);
  }

  const panels = metrics.filter((m) => (byMetric.get(m.metric_key)?.length ?? 0) > 0);

  if (!panels.length) {
    return (
      <div className="rounded-sm border border-line bg-white px-4 py-8 text-center">
        <p className="text-[13px] text-muted">
          No history yet. Amazon&rsquo;s performance report is a snapshot of
          today with no past in it, so this chart fills in one day at a time
          from the first sync — there is nothing to backfill.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {panels.map((metric) => (
          <Panel
            key={metric.metric_key}
            metric={metric}
            points={byMetric.get(metric.metric_key)!}
            target={trend.targets[metric.metric_key] ?? metric.metric_target}
          />
        ))}
      </div>

      {/* How much history there actually is. A 60-day axis drawn over five
          points would claim a trend that does not exist yet. */}
      <p className="text-[12px] text-muted">
        {trend.available_days === 1
          ? "One day of history so far."
          : `${trend.available_days} days of history so far`}
        {trend.available_days < trend.days
          ? `, of the ${trend.days} this chart will hold. Amazon's report carries no past, so the rest accumulates from here.`
          : "."}
      </p>
    </div>
  );
}

function Panel({
  metric,
  points,
  target,
}: {
  metric: HealthMetric;
  points: { date: string; value: number }[];
  target: number | null;
}) {
  // The scale has to contain the threshold as well as the data, or the
  // reference line lands outside the panel and the one thing the chart is for
  // is invisible.
  const values = points.map((p) => p.value);
  const candidates = target === null ? values : [...values, target];
  let min = Math.min(...candidates);
  let max = Math.max(...candidates);

  // A flat series has no range to scale by. Open it out around the value so
  // the line sits mid-panel rather than dividing by zero.
  if (max - min < 0.0001) {
    const nudge = Math.max(Math.abs(max) * 0.1, 0.5);
    min -= nudge;
    max += nudge;
  } else {
    const headroom = (max - min) * 0.15;
    min -= headroom;
    max += headroom;
  }

  const x = (index: number) =>
    points.length === 1
      ? W / 2
      : PAD_X + (index / (points.length - 1)) * (W - PAD_X * 2);
  const y = (value: number) =>
    PAD_Y + (1 - (value - min) / (max - min)) * (H - PAD_Y * 2);

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(p.value).toFixed(2)}`).join(" ");
  const latest = points[points.length - 1];
  const targetY = target === null ? null : y(target);

  return (
    <figure className="rounded-sm border border-line bg-white px-3.5 py-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          {metric.metric_label}
        </span>
        <span className="shrink-0 font-data text-[12px] text-muted tabular-nums">
          {formatPercent(latest.value)}
        </span>
      </figcaption>

      {/* No `preserveAspectRatio="none"`, and no fixed height. Stretching the
          viewBox to the container would scale x and y by different factors,
          which leaves the stroke recoverable (`vectorEffect`) but stretches
          the threshold label's type — so the height comes from the aspect
          ratio instead and the panel is whatever width its grid cell is. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block w-full"
        role="img"
        aria-label={ariaLabel(metric, points, target)}
      >
        {targetY !== null ? (
          <>
            {/* Amazon's limit. Dashed and in the alert hue, because it is the
                one line on the panel that is not this seller's data. */}
            <line
              x1={0}
              x2={W}
              y1={targetY}
              y2={targetY}
              stroke="var(--color-alert)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={W - 2}
              y={Math.max(targetY - 3, 8)}
              textAnchor="end"
              fill="var(--color-alert-ink)"
              style={{ fontSize: "8px", fontFamily: "var(--font-data)" }}
            >
              limit {formatPercent(target)}
            </text>
          </>
        ) : null}

        {points.length === 1 ? (
          <circle cx={x(0)} cy={y(latest.value)} r="2.5" fill="var(--color-primary-600)" />
        ) : (
          <path
            d={path}
            fill="none"
            stroke="var(--color-primary-600)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* The newest reading, marked. It is the number on the tile above. */}
        <circle
          cx={x(points.length - 1)}
          cy={y(latest.value)}
          r="2"
          fill="var(--color-primary-600)"
        />
      </svg>

      <p className="pt-1.5 text-[11px] text-muted-soft">
        {points.length === 1
          ? formatDate(points[0].date)
          : `${formatDate(points[0].date)} → ${formatDate(latest.date)}`}
      </p>
    </figure>
  );
}

/**
 * The panel, as a sentence.
 *
 * A line chart is unreadable to a screen reader, and this one carries
 * suspension risk — so the label states the range, the latest value and the
 * limit rather than being decorative.
 */
function ariaLabel(
  metric: HealthMetric,
  points: { date: string; value: number }[],
  target: number | null,
): string {
  const latest = points[points.length - 1];
  const limit =
    target === null
      ? ""
      : ` Amazon's limit is ${metric.higher_is_better ? "at least" : "at most"} ${formatPercent(target)}.`;
  return (
    `${metric.metric_label} over ${points.length} ` +
    `${points.length === 1 ? "reading" : "readings"}, ` +
    `${formatDate(points[0].date)} to ${formatDate(latest.date)}. ` +
    `Latest ${formatPercent(latest.value)}.${limit}`
  );
}
