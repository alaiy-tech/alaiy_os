import Link from "next/link";
import type { ReactNode } from "react";
import { NO_VALUE, formatMoney, formatNumber, percentDelta, type Delta } from "@/lib/format";
import { channelName } from "@/lib/channels";
import { ChannelMark } from "@/components/channel/channel-mark";
import type { ConnectorStatus } from "@/lib/backend/types";
import type { Movement } from "@/lib/home/overview";

/**
 * The four figures across the top of Home.
 *
 * Each tile is a number, what it is measured over, and how it moved. The
 * Dashboard's own tiles are a different four on a different clock (today
 * against this time last week) and they stay where they are — these are the
 * month a seller is in, which is the question Home opens with.
 *
 * **Sales and orders say "vs last month" and mean it literally.** Both are
 * month-to-date against the *same number of days* from the start of last
 * month, because a full previous month against eleven days of this one is not
 * a comparison. `lib/home/overview.ts` does that clamping; this renders it.
 *
 * Listings and stores carry no delta, and that is not an omission. Nothing
 * stores a count of either from a month ago, so a percentage next to them
 * would be invented. They get the thing that is true instead — how many are
 * live, how many stores are attached — and a way through to the tab.
 */

export function HomeTiles({
  sales,
  orderCount,
  currency,
  listings,
  connectors,
  comparable,
}: {
  sales: Movement;
  orderCount: Movement;
  currency: string | null;
  /** Listings matching no filter at all, or null when the read failed. */
  listings: number | null;
  connectors: ConnectorStatus[];
  /** False in the first days of a month — see `HomeOverview.comparable`. */
  comparable: boolean;
}) {
  const connected = connectors.filter((row) => row.connected);
  const since = comparable ? "vs last month" : "so far this month";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        index={0}
        // The one tinted tile. Money is what the screen is about, and the
        // landing's rule is that the thing being emphasised is a plate of
        // colour rather than a louder weight of the same type.
        feature
        icon={<BarChartIcon />}
        label="Total Sales"
        value={formatMoney(sales.value, currency)}
        delta={comparable ? percentDelta(sales.changePct) : undefined}
        footnote={since}
        link={{ href: "/orders", label: "Open Orders" }}
        title="Order value this month so far, against the same stretch of days last month."
      />
      <Tile
        index={1}
        icon={<BagIcon />}
        label="Total Orders"
        value={formatNumber(orderCount.value)}
        delta={comparable ? percentDelta(orderCount.changePct) : undefined}
        footnote={since}
        title="Orders placed this month so far, against the same stretch of days last month."
      />
      <Tile
        index={2}
        icon={<TagIcon />}
        label="Active Listings"
        value={listings === null ? NO_VALUE : formatNumber(listings)}
        footnote={
          listings === null ? "couldn't be read just now" : "across every channel"
        }
        link={{ href: "/listings", label: "Open Products" }}
        title="Listings synced from every connected channel."
      />
      <Tile
        index={3}
        icon={<LinkIcon />}
        label="Connected Stores"
        value={`${connected.length} / ${connectors.length || connected.length}`}
        footnote={
          connected.length ? (
            <span className="flex items-center gap-1.5">
              {connected.map((row) => (
                <ChannelMark key={row.channel} channel={row.channel} size="sm" />
              ))}
              <span className="sr-only">
                {connected.map((row) => channelName(row.channel)).join(", ")}
              </span>
            </span>
          ) : (
            "nothing attached yet"
          )
        }
        link={{ href: "/channels", label: "Open Connectors" }}
        title="Channels attached to this workspace and answering."
      />
    </div>
  );
}

type TileLink = { href: "/orders" | "/listings" | "/channels"; label: string };

function Tile({
  index,
  feature = false,
  icon,
  label,
  value,
  delta,
  footnote,
  link,
  title,
}: {
  index: number;
  feature?: boolean;
  icon: ReactNode;
  label: string;
  value: string;
  delta?: Delta;
  footnote: ReactNode;
  link?: TileLink;
  title?: string;
}) {
  return (
    <article
      className={`animate-rise relative rounded-lg border px-5 py-[18px] ${
        feature ? "border-highlight-300 bg-highlight-100" : "border-line bg-white"
      }`}
      style={{ animationDelay: `${index * 70}ms`, animationFillMode: "backwards" }}
      title={title}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
            feature ? "bg-white text-highlight-700" : "bg-highlight-100 text-highlight-700"
          }`}
        >
          {icon}
        </span>
        {link ? (
          // The whole tile is deliberately not a link. Three of the four are
          // figures a seller reads and leaves, and a card that navigates on a
          // stray click is how you lose the screen you were reading. The
          // corner glyph is the way through, and it says where it goes.
          <Link
            href={link.href}
            aria-label={link.label}
            title={link.label}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-white hover:text-primary-600"
          >
            <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4.5 12.5 10 7 15.5" />
            </svg>
          </Link>
        ) : null}
      </div>

      <h3 className="pt-3 font-sans text-[12px] font-medium text-muted">{label}</h3>
      {/* Geist Mono: every counter in this system is set in the mono face, and
          tabular by default so the figure holds its column as it changes. */}
      <p className="pt-1 font-data text-stat font-semibold leading-none tracking-tight text-ink tabular-nums">
        {value}
      </p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-2.5 text-[12px] leading-tight">
        {delta ? <DeltaText delta={delta} /> : null}
        <span className="text-muted">{footnote}</span>
      </div>
    </article>
  );
}

/**
 * The movement.
 *
 * Both tiles carrying one are tiles where up is good, so there is no `rising`
 * here — unlike the Dashboard's, where the return rate inverts it. The sign is
 * always in the label, so the colour reinforces and is never the only reading.
 */
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

function BarChartIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15V9M10 15V5M16 15v-4" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 7h9l.6 9H4.9l.6-9ZM7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 3.5h5.3l7.7 7.7-5.3 5.3-7.7-7.7V3.5Zm2.6 2.6h.01" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 11.5a3 3 0 0 0 4.24 0l2.1-2.1a3 3 0 1 0-4.24-4.24l-1 1M11.5 8.5a3 3 0 0 0-4.24 0l-2.1 2.1a3 3 0 1 0 4.24 4.24l1-1" />
    </svg>
  );
}
