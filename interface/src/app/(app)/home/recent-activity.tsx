import Link from "next/link";
import { formatClock, formatDate, formatRelativeDate } from "@/lib/format";
import { channelName } from "@/lib/channels";
import { ChannelMark } from "@/components/channel/channel-mark";
import type { ConnectorStatus, ImportJob } from "@/lib/backend/types";
import type { StoreRollup } from "@/lib/home/overview";

/**
 * What has happened lately, built out of what the app actually records.
 *
 * There is no event log on the backend — no "listing optimized", no "order
 * processed", nothing with an actor and a verb. What there is: when each
 * channel last answered a sync, what the current import is doing, and how
 * many orders each store has taken this month. So this is a feed of those
 * three, written as the facts they are.
 *
 * The alternative was a column of plausible-looking rows nobody could trace
 * to anything, on the one screen a seller opens to find out what is going on.
 * When the backend grows an events method this becomes a read of it and the
 * derivation goes away; until then the feed is short and true.
 *
 * ## No "2m ago"
 *
 * Frappe sends a naive timestamp in the *site's* timezone, so subtracting it
 * from the browser's clock is out by the offset and the browser cannot know
 * which — the chat list already refuses to do it for the same reason. A
 * day-level label is safe to read off the viewer's own calendar, and the
 * clock time beside it is exactly what the backend said. Both together are
 * more precise than "2m ago" and neither of them is a guess.
 */

type Entry = {
  key: string;
  /** Sorted on, newest first. Naive "YYYY-MM-DD HH:MM:SS" from the backend. */
  at: string;
  title: string;
  detail: string;
  mark: React.ReactNode;
};

export function RecentActivity({
  connectors,
  currentImport,
  byChannel,
  today,
}: {
  connectors: ConnectorStatus[];
  currentImport: ImportJob | null;
  byChannel: StoreRollup[];
  /** The server's calendar day, so "Today" is the site's today. */
  today: Date;
}) {
  const entries = buildEntries(connectors, currentImport, byChannel);

  return (
    <section aria-label="Recent activity" className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="text-display-sm text-ink">Recent Activity</h2>
        <Link
          href="/channels"
          className="text-[12px] font-medium text-highlight-700 underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </div>

      {entries.length ? (
        <ul className="divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.key} className="flex items-center gap-3 py-3">
              {entry.mark}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{entry.title}</p>
                <p className="truncate pt-0.5 text-[11.5px] text-muted">{entry.detail}</p>
              </div>
              <p
                className="shrink-0 text-right font-data text-[11px] text-muted-soft"
                title={formatDate(entry.at)}
              >
                {formatRelativeDate(entry.at, today)}
                <span className="block">{formatClock(entry.at)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-[13px] text-muted">
          Nothing yet. Connect a store and its first sync shows up here.
        </p>
      )}
    </section>
  );
}

function buildEntries(
  connectors: ConnectorStatus[],
  currentImport: ImportJob | null,
  byChannel: StoreRollup[],
): Entry[] {
  const entries: Entry[] = [];
  const orders = new Map(byChannel.map((row) => [row.channel, row.orders]));

  for (const connector of connectors) {
    if (!connector.connected || !connector.last_synced_at) continue;
    const name = channelName(connector.channel);
    const count = orders.get(connector.channel) ?? 0;
    entries.push({
      key: `sync-${connector.channel}`,
      at: connector.last_synced_at,
      title: connector.stale ? `${name} is overdue a sync` : `${name} synced`,
      detail: count
        ? `${count} ${count === 1 ? "order" : "orders"} this month`
        : (connector.account_label ?? "No orders this month"),
      mark: <ChannelMark channel={connector.channel} size="sm" />,
    });
  }

  // The import is the loudest thing that can be happening, so it goes in
  // whatever its state — a run still going is news, and a failed one is the
  // reason the figures above it look wrong.
  if (currentImport) {
    const at = currentImport.completed_at ?? currentImport.started_at;
    const failed = currentImport.steps.filter((step) => step.status === "failed");
    if (at) {
      entries.push({
        key: `import-${currentImport.id}`,
        at,
        title:
          currentImport.status === "completed"
            ? "First import finished"
            : currentImport.status === "failed"
              ? "Import failed"
              : "Import running",
        detail: failed.length
          ? `${failed.length} ${failed.length === 1 ? "step" : "steps"} failed`
          : `${currentImport.progress}% of ${currentImport.steps.length} steps`,
        mark: <ImportMark />,
      });
    }
  }

  // Newest first. String comparison is safe and intended: these are all
  // "YYYY-MM-DD HH:MM:SS" from the same site clock, so they sort lexically.
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
}

function ImportMark() {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 shrink-0 place-items-center rounded-xs bg-highlight-100 text-highlight-700"
    >
      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3.5v9M6.5 9.5 10 13l3.5-3.5M4 16h12" />
      </svg>
    </span>
  );
}
