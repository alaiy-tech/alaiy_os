import Link from "next/link";
import { formatMoney, formatNumber, percentDelta, type Delta } from "@/lib/format";
import { channelName } from "@/lib/channels";
import { ChannelMark } from "@/components/channel/channel-mark";
import type { ConnectorStatus } from "@/lib/backend/types";
import type { StoreRollup } from "@/lib/home/overview";

/**
 * One card per attached store: what it earned this month, and how that moved.
 *
 * The figures are this month's orders grouped by channel — the same pass that
 * produced the Sales tile, so the cards sum to it. A connected store with no
 * orders yet still gets a card, because "Amazon is attached and has sold
 * nothing this month" is a different and more useful statement than Amazon
 * being missing from the list.
 *
 * The dot is the connection, not the sales: `stale` comes off the backend's
 * own clock rather than being computed here from a naive timestamp — see the
 * note on `ConnectorStatus`.
 */

export function MyStores({
  connectors,
  byChannel,
  currency,
  comparable,
}: {
  connectors: ConnectorStatus[];
  byChannel: StoreRollup[];
  currency: string | null;
  /** False in the first days of a month — see `HomeOverview.comparable`.
   *  It bites hardest here: one store's one quiet day against one busy one
   *  is the noisiest percentage on the screen. */
  comparable: boolean;
}) {
  const connected = connectors.filter((row) => row.connected);
  if (!connected.length) return null;

  const sales = new Map(byChannel.map((row) => [row.channel, row]));
  // Ordered by what they earned, so the store carrying the month is first.
  const cards = [...connected].sort(
    (a, b) => (sales.get(b.channel)?.revenue.value ?? 0) - (sales.get(a.channel)?.revenue.value ?? 0),
  );

  return (
    <section aria-label="My stores" className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-2 pb-4">
        <h2 className="text-display-sm text-ink">My Stores</h2>
        <Link
          href="/channels"
          className="text-[12px] font-medium text-highlight-700 underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((connector) => (
          <StoreCard
            key={connector.channel}
            connector={connector}
            rollup={sales.get(connector.channel)}
            currency={currency}
            comparable={comparable}
          />
        ))}
      </div>
    </section>
  );
}

function StoreCard({
  connector,
  rollup,
  currency,
  comparable,
}: {
  connector: ConnectorStatus;
  rollup?: StoreRollup;
  currency: string | null;
  comparable: boolean;
}) {
  const name = channelName(connector.channel);
  const revenue = rollup?.revenue;

  return (
    <article className="rounded-lg border border-line bg-canvas p-3.5">
      <div className="flex items-center gap-2.5">
        <ChannelMark channel={connector.channel} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
          <p className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                connector.stale ? "bg-warn" : "bg-ok"
              }`}
            />
            {connector.stale ? "Sync overdue" : "Connected"}
          </p>
        </div>
      </div>

      <p className="pt-3 font-data text-[19px] font-semibold leading-none tracking-tight text-ink tabular-nums">
        {formatMoney(revenue?.value ?? 0, currency)}
      </p>

      <div className="flex items-end justify-between gap-2 pt-2">
        <span className="text-[12px] leading-tight">
          {revenue && comparable ? (
            <DeltaText delta={percentDelta(revenue.changePct)} />
          ) : (
            <span className="text-muted">this month</span>
          )}
        </span>
        {rollup?.spark.some((value) => value > 0) ? (
          <Sparkline values={rollup.spark} rising={(revenue?.changePct ?? 0) >= 0} />
        ) : null}
      </div>

      <p className="pt-3 text-[11px] text-muted">
        {formatNumber(rollup?.orders ?? 0)} {rollup?.orders === 1 ? "order" : "orders"}
        {" this month"}
      </p>
    </article>
  );
}

function DeltaText({ delta }: { delta: Delta }) {
  if (delta.direction === "none" || delta.direction === "flat") {
    return <span className="text-muted-soft">{delta.label}</span>;
  }
  return (
    <span
      className={`font-data font-semibold ${
        delta.direction === "up" ? "text-ok-ink" : "text-alert-ink"
      }`}
    >
      <span aria-hidden>{delta.direction === "up" ? "↑" : "↓"} </span>
      {delta.label}
    </span>
  );
}

/**
 * This month's daily takings, at thumbnail size.
 *
 * Decorative, and `aria-hidden` for that reason: the figure and the movement
 * beside it already say everything this shows, and a screen reader being read
 * forty path coordinates learns nothing. Drawn as a line rather than bars
 * because at 64px wide a bar per day is a smear.
 */
function Sparkline({ values, rising }: { values: number[]; rising: boolean }) {
  const width = 64;
  const height = 22;
  const peak = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((value, index) => `${(index * step).toFixed(1)},${(height - (value / peak) * height).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={`h-[22px] w-16 shrink-0 ${rising ? "text-ok" : "text-alert"}`}
      fill="none"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
