import { Stepper } from "@/components/onboarding/stepper";
import { Alert, Eyebrow } from "@/components/ui";
import { amazonAppStatus, listConnectors } from "@/lib/backend/connectors";
import { BackendError } from "@/lib/backend/client";
import { CHANNELS, UPCOMING_CHANNELS } from "@/lib/channels";
import type { SessionPayload } from "@/lib/auth/session";
import type { ConnectorStatus } from "@/lib/backend/types";
import { ConnectorRows, UpcomingRows } from "./connector-rows";
import { ImportLauncher } from "./import-launcher";

/**
 * The whole of onboarding after the profile: every connector, and a Connect on
 * the right of each.
 *
 * There is no longer a channel-picking step in front of this. It asked which
 * channels the seller intended to connect, wrote the answer to
 * `selected_channels`, and then nothing read it — the import already derives
 * its channels from what is genuinely attached, because a job for a channel
 * that was only *selected* would fail on its first call. Intent was never the
 * question; connecting is.
 *
 * Amazon's consent redirect comes back through /onboarding/connect to /start,
 * so `error` and `connected` are the same round-trip they always were.
 */
export async function ConnectStep({
  session,
  error,
  connected,
}: {
  session: SessionPayload;
  /** Already user-facing — the copy lives with the other callback failures. */
  error?: string;
  connected?: string;
}) {
  let connectors: ConnectorStatus[] = [];
  let amazonReady = false;
  /** The check itself failed — distinct from it answering "not configured". */
  let amazonUnavailable = false;
  let loadError: string | undefined;
  try {
    // Whether the SP-API app is configured is a property of the bench, so ask
    // it rather than looking for credentials this app deliberately lacks.
    const [list, amazon] = await Promise.all([
      listConnectors(session.workspaceId, session.backendToken),
      // Settled, not caught-to-false. Collapsing a failure into "not ready"
      // renders it as "Amazon isn't configured on this environment" — advice
      // that sent us checking a site_config which was correct all along, while
      // the real cause was a 500 from a version skew between this app and the
      // connector. A broken check and an unconfigured bench are different
      // problems and have to read differently.
      amazonAppStatus(session.backendToken).then(
        (value) => ({ ok: true as const, value }),
        (cause) => ({ ok: false as const, cause }),
      ),
    ]);
    connectors = list;
    if (amazon.ok) {
      amazonReady = amazon.value.ready;
    } else {
      amazonUnavailable = true;
    }
  } catch (cause) {
    loadError =
      cause instanceof BackendError && cause.status >= 500
        ? "We couldn't reach Alaiy to check your connections."
        : "We couldn't load your connections.";
  }

  const connectedIds = connectors.filter((c) => c.connected).map((c) => c.channel);

  return (
    <div className="space-y-6">
      <Stepper current="connect" skipProfile={session.skipProfile} />

      <header className="space-y-1.5">
        {/* <Eyebrow>{session.skipProfile ? "Last step" : "Step two"}</Eyebrow> */}
        <h2 className="text-display-md">Connect your accounts</h2>
        {/* Deliberately does not say "add the rest later from Channels". The
            Channels tab's Connect link points back here, and this screen
            redirects anyone who has finished onboarding — so that would be a
            promise the app does not currently keep. */}
        <p className="text-sm text-muted">
          Connect the ones you sell on. 
        </p>
      </header>

      {error ? <Alert>{error}</Alert> : null}
      {loadError ? <Alert>{loadError}</Alert> : null}

      <div className="space-y-6">
        <ConnectorRows
          channels={CHANNELS}
          statuses={connectors}
          amazonReady={amazonReady}
          amazonUnavailable={amazonUnavailable}
        />
      </div>

      <ImportLauncher connectedChannels={connectedIds} />
    </div>
  );
}
