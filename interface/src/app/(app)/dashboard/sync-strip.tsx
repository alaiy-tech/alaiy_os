import Link from "next/link";
import { channelName } from "@/lib/channels";
import { formatClock, formatDateTime } from "@/lib/format";
import type { ConnectorStatus } from "@/lib/backend/types";

/**
 * When each channel was last pulled, and when these figures were computed.
 *
 * The quietest thing on the screen and the one that decides whether the rest
 * of it can be trusted: every number above is only as current as the last
 * successful sync, and a seller reading a flat GMV tile has no way to tell a
 * slow morning from a channel that stopped talking to us nine hours ago.
 *
 * A channel marked stale is also raised as an alert by the backend, off the
 * same threshold. That is not a duplicate: this line is where a seller checks
 * freshness on purpose, the alert is where they are told without looking.
 *
 * Whether a channel *is* stale comes from the backend and is not computed
 * here. Frappe sends a naive local timestamp, so the arithmetic only works in
 * the process that knows the site's timezone — see `ConnectorStatus.stale`.
 */

export function SyncStrip({
  connectors,
  asOf,
}: {
  connectors: ConnectorStatus[];
  /** When the backend added these totals up, from `HomeDashboard.as_of`. */
  asOf?: string;
}) {
  const connected = connectors.filter((row) => row.connected);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        Last synced
      </span>

      {connected.length === 0 ? (
        <span className="text-muted">
          No channel is connected —{" "}
          <Link
            href="/channels"
            className="underline underline-offset-2 hover:text-primary-600"
          >
            connect one
          </Link>{" "}
          and these figures start filling in.
        </span>
      ) : (
        connected.map((row) => <ChannelSync key={row.channel} status={row} />)
      )}

      {/* Not the same fact as any of the above. A channel's timestamp says when
          data last arrived; this says when these totals were added up, which is
          what a seller who has had the tab open for an hour needs to know. */}
      {asOf ? (
        <span className="ml-auto font-data text-muted-soft">
          figures as of {formatClock(asOf)}
        </span>
      ) : null}
    </div>
  );
}

function ChannelSync({ status }: { status: ConnectorStatus }) {
  return (
    <span className="flex items-center gap-1.5">
      {/* Amber only when the pull is actually late. The timestamp beside it is
          always spelled out, so the dot is a shortcut down the line and never
          the only way to read it. */}
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${status.stale ? "bg-warn" : "bg-ok"}`}
      />
      <span className="text-muted">{channelName(status.channel)}</span>
      <span
        className={`font-data ${status.stale ? "text-warn-ink" : "text-muted-soft"}`}
        title={status.stale ? "Overdue — Alaiy pulls each channel hourly." : undefined}
      >
        {status.last_synced_at ? formatDateTime(status.last_synced_at) : "not yet"}
      </span>
    </span>
  );
}
