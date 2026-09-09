import type { ReactNode } from "react";
import {
  NO_VALUE,
  formatMoney,
  formatNumber,
  formatPercent,
  percentDelta,
  pointDelta,
  weekdayName,
  type Delta,
} from "@/lib/format";
import type { HomeDashboard } from "@/lib/backend/types";

/**
 * The four figures across the top of Home.
 *
 * Each tile is a number, what it is measured over, and how it moved — nothing
 * else. No sparklines and no channel split: both are on the issue's V2 list,
 * and both would turn a tile a seller reads in a second into a chart they read
 * in five.
 *
 * **The four windows are different, and each tile says which one it is.** GMV
 * and orders are today so far; the return rate is a rolling week, because one
 * day of returns is not a rate. A row of tiles that all looked the same but
 * meant different periods would be the single most misleading thing that could
 * go on this screen, so the period is on every one of them rather than in a
 * heading above them all.
 */

export function KpiTiles({ dashboard }: { dashboard: HomeDashboard }) {
  // Nothing has ever arrived. Four zeroes would each be a lie of a different
  // kind, and "no data yet" is one sentence that is true.
  if (!dashboard.has_any_orders) {
    return (
      <div className="rounded-sm border border-line bg-white px-4 py-8 text-center">
        <p className="text-[13px] text-muted">
          No orders have arrived from your channels yet. Your figures appear
          here as soon as the first import finishes.
        </p>
      </div>
    );
  }

  const { gmv, orders, return_rate: returns, unsettled, windows, currency } = dashboard;

  // "vs. the same point last Tuesday" — the weekday, because a business with a
  // weekly pattern compares like days, and a date would make the reader work
  // out which day that was.
  const lastWeekday = weekdayName(windows.compare.from);
  const against = lastWeekday
    ? `vs. this time last ${lastWeekday}`
    : "vs. the same point last week";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="GMV today"
          value={formatMoney(gmv.value, currency)}
          delta={percentDelta(gmv.change_pct)}
          rising="good"
          footnote={against}
          title={
            "Merchandise value — the sum of the order lines placed since midnight, " +
            "before tax and shipping. Both this figure and the comparison stop at " +
            "the same time of day."
          }
        />
        <Tile
          label="Orders today"
          value={formatNumber(orders.value)}
          delta={percentDelta(orders.change_pct)}
          rising="good"
          footnote={against}
          title="Distinct orders placed since midnight, across every connected channel."
        />
        <Tile
          label="Return rate"
          value={formatPercent(returns.value)}
          delta={pointDelta(returns.change_pp)}
          // The one tile where up is the bad direction.
          rising="bad"
          footnote={`rolling ${windows.rolling.days} days · ${formatNumber(
            returns.returned_orders,
          )} of them`}
          title={
            "Share of orders refunded or cancelled. Neither channel exposes RMA " +
            "returns to us, so this is the closest the synced data comes to a return. " +
            "The change is in percentage points, not percent."
          }
        />
        <Tile
          label="Unsettled"
          value={unsettled.available ? formatMoney(unsettled.value, currency) : NO_VALUE}
          footnote={
            unsettled.available
              ? "pending disbursement"
              : "settlements aren't synced yet"
          }
          title={
            unsettled.available
              ? "Money taken and not yet paid out."
              : "Amazon settlement reports are not synced yet, so there is no figure to " +
                "show. An empty tile rather than a zero, because a zero here would read " +
                "as 'you have been paid everything'."
          }
        />
      </div>

      {dashboard.mixed_currencies ? (
        <p className="text-[12px] text-warn-ink">
          Your channels report in more than one currency — the money above is
          the {currency} side only.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One tile.
 *
 * `rising` is which way is up in the sense that matters: sales rising is good
 * and returns rising is not, and a tile that coloured every increase green
 * would congratulate a seller on their return rate. The label always carries
 * the sign, so the colour is reinforcement and never the only reading — see
 * the contrast note in DESIGN.md.
 */
function Tile({
  label,
  value,
  delta,
  rising = "neutral",
  footnote,
  title,
}: {
  label: string;
  value: string;
  delta?: Delta;
  rising?: "good" | "bad" | "neutral";
  footnote: ReactNode;
  title?: string;
}) {
  return (
    <article className="rounded-sm border border-line bg-white px-4 py-3.5" title={title}>
      <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {label}
      </h3>
      {/* Geist and tabular figures: this is the number the seller came for,
          and Poppins sets numerals proportionally. */}
      <p className="pt-2 font-data text-[27px] font-semibold leading-none tracking-tight text-primary-600 tabular-nums">
        {value}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-1.5 pt-2.5 text-[12px] leading-tight">
        {delta ? <DeltaText delta={delta} rising={rising} /> : null}
        <span className="text-muted">{footnote}</span>
      </p>
    </article>
  );
}

function DeltaText({
  delta,
  rising,
}: {
  delta: Delta;
  rising: "good" | "bad" | "neutral";
}) {
  // No baseline means no claim: no arrow, no percentage, and the reason said
  // out loud instead.
  if (delta.direction === "none" || delta.direction === "flat") {
    return <span className="text-muted-soft">{delta.label}</span>;
  }

  const helpful =
    rising === "neutral" ? null : (delta.direction === "up") === (rising === "good");
  const tone =
    helpful === null
      ? "text-muted"
      : helpful
        ? "text-ok-ink"
        : "text-alert-ink";

  return (
    <span className={`font-data font-semibold ${tone}`}>
      <span aria-hidden>{delta.direction === "up" ? "↑" : "↓"} </span>
      {delta.label}
    </span>
  );
}
