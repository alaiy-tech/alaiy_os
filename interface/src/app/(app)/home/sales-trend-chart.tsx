import { formatMoney } from "@/lib/format";
import type { ChannelOrder } from "@/lib/backend/types";

/**
 * Order value by day, over whatever window of real orders was fetched for
 * this chart.
 *
 * Built from the same `ChannelOrder` rows the Orders tab reads — no separate
 * time-series endpoint exists yet, so this buckets real order dates and
 * totals rather than inventing a smoother series. The label says exactly
 * what window it covers rather than implying a "30D / 90D" toggle this data
 * doesn't back yet.
 */
export function SalesTrendChart({
  orders,
  days,
  currency,
}: {
  orders: ChannelOrder[];
  days: number;
  currency: string | null;
}) {
  const buckets = bucketByDay(orders, days);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));

  const width = 640;
  const height = 160;
  const padding = { top: 8, bottom: 20, left: 4, right: 4 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const gap = 3;
  const barWidth = Math.max(2, plotWidth / buckets.length - gap);

  // Every day is labelled would be unreadable past ~10 bars; thin to about
  // six evenly-spaced labels, always including the first and last day.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));

  return (
    <div className="rounded-sm border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4">
        <h2 className="text-display-sm">Order value, last {days} days</h2>
        <p className="text-[12px] text-muted">
          {buckets.filter((bucket) => bucket.value > 0).length} days with sales
        </p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Order value per day over the last ${days} days, from ${formatMoney(
          0,
          currency,
        )} to ${formatMoney(max, currency)}`}
      >
        {buckets.map((bucket, index) => {
          const x = padding.left + index * (barWidth + gap);
          const barHeight = (bucket.value / max) * plotHeight;
          const y = padding.top + plotHeight - barHeight;
          return (
            <rect
              key={bucket.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, bucket.value > 0 ? 2 : 0)}
              rx={Math.min(3, barWidth / 2)}
              className="fill-primary-600 transition-opacity hover:fill-highlight-600"
            />
          );
        })}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={width - padding.right}
          y2={padding.top + plotHeight}
          className="stroke-line"
          strokeWidth={1}
        />
      </svg>

      <div className="flex justify-between pt-1.5 font-data text-meta text-muted-soft">
        {buckets.map((bucket, index) =>
          index % labelEvery === 0 || index === buckets.length - 1 ? (
            <span key={bucket.date}>{shortDate(bucket.date)}</span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function bucketByDay(orders: ChannelOrder[], days: number): { date: string; value: number }[] {
  // Computed once, here, rather than reaching for `new Date()` at module or
  // render scope — the same reasoning as `localDay()` in chat-workspace.tsx:
  // a value that can differ between two calls in the same render has no
  // business inside output React has to reconcile.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series: { date: string; value: number }[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    series.push({ date: isoDay(day), value: 0 });
  }

  const byDate = new Map(series.map((bucket) => [bucket.date, bucket]));
  for (const order of orders) {
    if (!order.order_date) continue;
    const day = order.order_date.slice(0, 10);
    const bucket = byDate.get(day);
    if (bucket) bucket.value += order.order_total ?? 0;
  }

  return series;
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}
