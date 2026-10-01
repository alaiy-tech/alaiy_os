import { formatMoney } from "@/lib/format";
import type { DayPoint } from "@/lib/home/overview";

/**
 * Order value by day — this month against last.
 *
 * Both series are real. They are the same two windows the Sales and Orders
 * tiles compare, bucketed by day instead of summed, so the chart and the tile
 * above it cannot tell a seller different things about the same month.
 *
 * **There is no 7D / 30D / 90D toggle, and no metric dropdown.** Not an
 * oversight: there is no time-series endpoint, so the window this chart can
 * honestly draw is the window `listOrders` was asked for, and a control that
 * re-ranged a fetch it does not have would either lie or re-request the page.
 * The heading says which months these are rather than implying a range the
 * data cannot answer. Both arrive the day the backend grows the method.
 *
 * Drawn as paired bars rather than two lines: a month-to-date series is a
 * stack of discrete days — some of them zero — and a line between two zero
 * days draws a slope through sales that did not happen.
 */

const WIDTH = 460;
const HEIGHT = 190;
const PAD = { top: 10, bottom: 20, left: 40, right: 4 };
/**
 * A bar never gets wider than this.
 *
 * On the 1st of a month the chart has one slot, and a slot's share of the
 * plot is the whole plot — without a ceiling the day renders as a single
 * black slab across the card. The cap costs nothing on a full month, where
 * a day's share is a few pixels anyway.
 */
const MAX_BAR = 16;

export function SalesPerformance({
  thisMonth,
  lastMonth,
  currency,
  thisLabel,
  lastLabel,
}: {
  thisMonth: DayPoint[];
  lastMonth: DayPoint[];
  currency: string | null;
  /** "October", and last month's name — written by the server, so the
   *  month a seller reads is the server's month and not the browser's. */
  thisLabel: string;
  lastLabel: string;
}) {
  // The axis covers both series, so the two months are drawn to one scale —
  // bars measured against their own maximum would make every month look the
  // same shape and the comparison worthless.
  const peak = Math.max(1, ...thisMonth.map((d) => d.value), ...lastMonth.map((d) => d.value));
  const top = niceCeiling(peak);
  const slots = Math.max(thisMonth.length, lastMonth.length);

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slotWidth = plotWidth / slots;
  // Two bars share a slot with a hairline between them, and the pair is
  // inset so neighbouring days do not read as one block.
  const barWidth = Math.min(MAX_BAR, Math.max(1.5, slotWidth / 2 - 1.2));

  const y = (value: number) => PAD.top + plotHeight - (value / top) * plotHeight;
  const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  // Past about ten labels the axis is unreadable, so thin to roughly six,
  // always keeping the 1st and the last day.
  const labelEvery = Math.max(1, Math.ceil(slots / 6));

  const sold = thisMonth.filter((d) => d.value > 0).length;

  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 pb-4">
        <div>
          <h2 className="text-display-sm text-ink">Sales Performance</h2>
          <p className="pt-0.5 text-[12px] text-muted">
            Order value per day · {sold} {sold === 1 ? "day" : "days"} with sales this month
          </p>
        </div>
        <ul className="flex shrink-0 items-center gap-4 text-[12px]">
          <Key swatch="bg-primary-600" label={thisLabel} />
          <Key swatch="bg-highlight-300" label={lastLabel} />
        </ul>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Order value per day. ${thisLabel} so far totals ${formatMoney(
          thisMonth.reduce((sum, d) => sum + d.value, 0),
          currency,
        )}; the same days of ${lastLabel} totalled ${formatMoney(
          lastMonth.reduce((sum, d) => sum + d.value, 0),
          currency,
        )}.`}
      >
        {gridlines.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(value)}
              y2={y(value)}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(value) + 3.5}
              textAnchor="end"
              className="fill-muted-soft font-data text-[8.5px]"
            >
              {axisLabel(value, currency)}
            </text>
          </g>
        ))}

        {Array.from({ length: slots }, (_, index) => {
          const current = thisMonth[index]?.value ?? 0;
          const baseline = lastMonth[index]?.value ?? 0;
          const slotX = PAD.left + index * slotWidth;
          const day = index + 1;
          return (
            <g key={day}>
              {/* Last month first, so a taller current bar is never hidden
                  behind the one it is being compared with. */}
              {baseline > 0 ? (
                <rect
                  x={slotX + slotWidth / 2 + 0.6}
                  y={y(baseline)}
                  width={barWidth}
                  height={Math.max(1, PAD.top + plotHeight - y(baseline))}
                  rx={1.5}
                  className="fill-highlight-300"
                >
                  <title>{`${day} ${lastLabel}: ${formatMoney(baseline, currency)}`}</title>
                </rect>
              ) : null}
              {current > 0 ? (
                <rect
                  x={slotX + slotWidth / 2 - barWidth - 0.6}
                  y={y(current)}
                  width={barWidth}
                  height={Math.max(1, PAD.top + plotHeight - y(current))}
                  rx={1.5}
                  className="fill-primary-600"
                >
                  <title>{`${day} ${thisLabel}: ${formatMoney(current, currency)}`}</title>
                </rect>
              ) : null}
              {index % labelEvery === 0 || index === slots - 1 ? (
                <text
                  x={slotX + slotWidth / 2}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-muted-soft font-data text-[8.5px]"
                >
                  {day}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function Key({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-muted">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${swatch}`} />
      {label}
    </li>
  );
}

/** A round number at or above the peak, so the axis reads in whole steps. */
function niceCeiling(peak: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= peak) return candidate;
  }
  return 10 * magnitude;
}

/** Short money for an axis: "₹4L" rather than "₹4,00,000". */
function axisLabel(value: number, currency: string | null): string {
  if (value === 0) return "0";
  const symbol = currency === "INR" ? "₹" : "";
  // Lakh and crore, because the money on this screen is Indian and a seller
  // reading "400K" has to convert it back.
  if (symbol) {
    if (value >= 10_000_000) return `${symbol}${trim(value / 10_000_000)}Cr`;
    if (value >= 100_000) return `${symbol}${trim(value / 100_000)}L`;
    if (value >= 1_000) return `${symbol}${trim(value / 1_000)}K`;
    return `${symbol}${Math.round(value)}`;
  }
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trim(value / 1_000)}K`;
  return String(Math.round(value));
}

function trim(value: number): string {
  return value.toFixed(value < 10 ? 1 : 0).replace(/\.0$/, "");
}
