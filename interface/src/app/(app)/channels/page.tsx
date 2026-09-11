import { requireOnboardedSession } from "@/lib/auth/dal";
import {
  amazonAppStatus,
  listConnectors,
  listPermissions,
} from "@/lib/backend/connectors";
import { getLatestImport } from "@/lib/backend/imports";
import { CHANNELS } from "@/lib/channels";
import { formatDate } from "@/lib/format";
import { Alert, Eyebrow } from "@/components/ui";
import type {
  ChannelId,
  ChannelPermission,
  ConnectorStatus,
  ImportJob,
} from "@/lib/backend/types";
import { ChannelCard } from "./channel-card";

export const metadata = { title: "Channels — Alaiy" };

/**
 * The Channels tab: what each channel is attached to, and control over it.
 *
 * Every live channel is rendered, connected or not, so the tab answers "what
 * could I be syncing?" rather than only "what am I syncing?". A channel
 * that has never been connected can be connected from its own card, using the
 * same components the onboarding step uses (`components/connect/`) — so there
 * is still one credential form on the codebase, just not one screen that owns
 * it. It used to be a Connect link to /start, which redirects anyone who has
 * finished onboarding: the button existed and went to Home.
 *
 * Each card also carries the channel's consent list — the permissions the
 * seller approved on the way in — and lets them narrow one afterwards. That is
 * the only place in the app where a seller can answer "what can Alaiy actually
 * read from my Amazon account?", and the connection it belongs to is the only
 * place it makes sense to ask.
 */
export default async function ChannelsPage() {
  const session = await requireOnboardedSession();

  // Three independent reads, and only the first is fatal to this page. The
  // import line is context for the sync buttons; losing it should not cost the
  // seller the controls.
  const [connectors, latestImport, amazon] = await Promise.all([
    listConnectors(session.workspaceId, session.backendToken).catch(
      () => null as ConnectorStatus[] | null,
    ),
    getLatestImport(session.workspaceId, session.backendToken).catch(
      () => null as ImportJob | null,
    ),
    // Settled, not caught-to-false, for the reason the connect step spells
    // out: collapsing a failed check into "not ready" renders as "Amazon
    // isn't configured on this environment", which sends whoever reads it to
    // check a site_config that was correct all along.
    amazonAppStatus(session.backendToken).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
  ]);

  const statusFor = (channel: string) =>
    connectors?.find((connector) => connector.channel === channel);

  // Live channels, plus any switched-off channel this workspace is still
  // attached to. A store connected while its channel was live would otherwise
  // vanish from the tab and keep syncing with nothing to stop it — so it keeps
  // a card, minus the controls that would deepen the connection.
  const visible = CHANNELS.filter(
    (channel) => channel.live || statusFor(channel.id)?.connected,
  );

  // One read per visible channel, after `visible` rather than alongside the
  // three above — the list is what says which channels have a card, and asking
  // for a channel that is not rendered is a round trip nobody sees.
  //
  // Each is caught to null on its own. A permission list is context, not
  // control: losing it must not take the Sync and Disconnect buttons with it,
  // and losing Amazon's must not hide Shopify's.
  const permissions = new Map<ChannelId, ChannelPermission[] | null>(
    await Promise.all(
      visible.map(
        async (channel) =>
          [
            channel.id,
            await listPermissions(
              session.workspaceId,
              channel.id,
              session.backendToken,
            ).catch(() => null),
          ] as const,
      ),
    ),
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Where it comes from</Eyebrow>
        <h1 className="text-display-md">Channels</h1>
        <p className="text-[13px] text-muted">
          Where your data comes from. Disconnect a channel to stop syncing it,
          pull a fresh copy now, or narrow what we may read from it.
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
            {visible.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel.id}
                name={channel.name}
                live={channel.live}
                status={statusFor(channel.id)}
                permissions={permissions.get(channel.id) ?? null}
                amazonReady={amazon.ok ? amazon.value.ready : false}
                amazonUnavailable={!amazon.ok}
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
