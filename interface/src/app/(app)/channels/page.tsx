import { requireOnboardedSession } from "@/lib/auth/dal";
import { listConnectors } from "@/lib/backend/connectors";
import { getLatestImport } from "@/lib/backend/imports";
import { CHANNELS } from "@/lib/channels";
import { formatDate } from "@/lib/format";
import { Alert, Eyebrow } from "@/components/ui";
import type { ConnectorStatus, ImportJob } from "@/lib/backend/types";
import { ChannelCard } from "./channel-card";

export const metadata = { title: "Channels — Alaiy" };

/**
 * The Channels tab: what each channel is attached to, and control over it.
 *
 * Both channels are always rendered, connected or not, so the tab answers
 * "what could I be syncing?" rather than only "what am I syncing?". A channel
 * that has never been connected shows a Connect link back into the onboarding
 * step that owns the credential forms — there is one place that knows how to
 * take a Shopify token or start Amazon's consent flow, and duplicating it here
 * would mean two copies of that to keep right.
 */
export default async function ChannelsPage() {
  const session = await requireOnboardedSession();

  // Two independent reads, neither fatal. The import line is context for the
  // sync buttons; losing it should not cost the seller the controls.
  const [connectors, latestImport] = await Promise.all([
    listConnectors(session.workspaceId, session.backendToken).catch(
      () => null as ConnectorStatus[] | null,
    ),
    getLatestImport(session.workspaceId, session.backendToken).catch(
      () => null as ImportJob | null,
    ),
  ]);

  const statusFor = (channel: string) =>
    connectors?.find((connector) => connector.channel === channel);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Where it comes from</Eyebrow>
        <h1 className="text-display-md">Channels</h1>
        <p className="text-[13px] text-muted">
          Where your data comes from. Disconnect a channel to stop syncing it,
          or pull a fresh copy now.
        </p>
      </div>

      {connectors === null ? (
        <Alert>
          We couldn&apos;t load your connections. The controls below need that
          to be accurate, so they&apos;re hidden until it works.
        </Alert>
      ) : (
        <>
          {latestImport ? <ImportLine job={latestImport} /> : null}

          <div className="space-y-3">
            {CHANNELS.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel.id}
                name={channel.name}
                status={statusFor(channel.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One line of context: what the last full import did, and when. */
function ImportLine({ job }: { job: ImportJob }) {
  const when = job.completed_at ?? job.started_at;
  const stamp = when ? formatDate(when) : null;

  const description =
    job.status === "completed"
      ? stamp
        ? `Last full import finished ${stamp}.`
        : "Last full import finished."
      : job.status === "failed"
        ? "The last full import failed. A manual sync below is the way to retry."
        : `A full import is ${job.status} — ${job.progress}% through.`;

  return (
    <p className="rounded-sm border border-line bg-surface px-3.5 py-2.5 text-[12px] text-muted">
      {description}
    </p>
  );
}
