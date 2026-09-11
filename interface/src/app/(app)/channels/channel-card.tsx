"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  disconnectChannelAction,
  syncChannelAction,
  type ChannelActionState,
} from "./actions";
import { ChannelPermissions } from "./channel-permissions";
import { AmazonAction } from "@/components/connect/amazon-action";
import { ShopifyForm } from "@/components/connect/shopify-form";
import { Alert, Pill, Spinner, pressClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type {
  ChannelId,
  ChannelPermission,
  ConnectorStatus,
} from "@/lib/backend/types";

/**
 * One channel's card: what it is connected to, and the two things a seller can
 * do about it.
 *
 * A client component because each card owns its own action state — an error
 * from syncing Shopify must appear on the Shopify card and nowhere else, which
 * a single page-level state could not express. The two forms share one state
 * hook per card, so triggering a sync clears the previous notice rather than
 * stacking messages up.
 *
 * A card only reaches this component when its channel is live or when it is
 * connected (see the page). The `live` prop is what separates those: a card
 * for a switched-off channel exists to be wound down, so it keeps its status
 * and its Disconnect and loses everything that would deepen the connection.
 */

const CHANNEL_BLURB: Record<ChannelId, string> = {
  shopify: "Orders, products and inventory. Real-time once webhooks are live.",
  amazon: "Orders and inventory over SP-API.",
};

export function ChannelCard({
  channel,
  name,
  live,
  status,
  permissions,
  amazonReady,
  amazonUnavailable,
}: {
  channel: ChannelId;
  name: string;
  /** Still connectable. Off means wind-down only — no connect, no sync. */
  live: boolean;
  status?: ConnectorStatus;
  /** The channel's consent list. Null when that read failed. */
  permissions: ChannelPermission[] | null;
  /** Whether the bench has SP-API app credentials. Amazon's row only. */
  amazonReady: boolean;
  /** That check itself failed, so we do not know either way. */
  amazonUnavailable: boolean;
}) {
  const [connecting, setConnecting] = useState(false);
  const connected = Boolean(status?.connected);

  return (
    <div className="rounded-sm border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-display-sm">{name}</h2>
            <StatusPill status={status} />
          </div>

          <p className="text-[13px] text-muted">
            {live
              ? CHANNEL_BLURB[channel]
              : `${name} is switched off. Everything already imported stays; disconnect to stop syncing it.`}
          </p>

          {connected ? (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 pt-1.5 text-[12px]">
              {status?.account_label ? (
                <Detail label="Account" value={status.account_label} />
              ) : null}
              {status?.marketplace ? (
                <Detail label="Region" value={status.marketplace} />
              ) : null}
              <Detail
                label="Last synced"
                value={
                  status?.last_synced_at ? formatDate(status.last_synced_at) : "never"
                }
              />
            </dl>
          ) : null}
        </div>

        {/* Connecting happens here, not on /start. That link is what sent a
            seller clicking Connect to Home: /start redirects anyone who has
            finished onboarding, so the credential form was unreachable to
            everyone except someone still mid-signup. Amazon is one click out
            to Seller Central, so its row carries the action itself; Shopify
            needs three fields, so its button opens them below. */}
        {!connected && live ? (
          channel === "amazon" ? (
            <AmazonAction ready={amazonReady} unavailable={amazonUnavailable} />
          ) : (
            <button
              type="button"
              onClick={() => setConnecting((open) => !open)}
              aria-expanded={connecting}
              className={`${pressClass(
                connecting ? { ground: "quiet", size: "sm" } : { size: "sm" },
              )} shrink-0`}
            >
              {connecting ? "Cancel" : "Connect"}
            </button>
          )
        ) : null}
      </div>

      {/* Collapsed until asked for, so an unconnected channel still costs one
          card. It closes on its own once connected: the action refreshes this
          page, `connected` flips, and the whole branch stops rendering. */}
      {!connected && live && channel === "shopify" && connecting ? (
        <div className="border-t border-line px-5 py-4">
          <ShopifyForm />
        </div>
      ) : null}

      {/* The channel's own last error, straight from the connection record. It
          survives a reload, unlike an action's error, so it belongs to the card
          rather than to a form. */}
      {status?.error ? (
        <div className="border-t border-line px-5 py-3">
          <Alert>{status.error}</Alert>
        </div>
      ) : null}

      {connected ? (
        <ConnectedControls channel={channel} name={name} live={live} />
      ) : null}

      {/* Last, and on an unconnected card too. The list is a property of the
          channel rather than of the connection, so "what would attaching
          Amazon let you read?" is answerable before attaching it — read-only
          there, because a setting saved against nothing is a setting that
          reads later as though someone configured it for you. */}
      <ChannelPermissions
        channel={channel}
        name={name}
        connected={connected}
        permissions={permissions}
      />
    </div>
  );
}

function ConnectedControls({
  channel,
  name,
  live,
}: {
  channel: ChannelId;
  name: string;
  live: boolean;
}) {
  const [state, formAction] = useActionState<ChannelActionState, FormData>(
    async (previous, formData) =>
      formData.get("intent") === "disconnect"
        ? disconnectChannelAction(previous, formData)
        : syncChannelAction(previous, formData),
    {},
  );

  return (
    <div className="space-y-3 border-t border-line px-5 py-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.notice ? <Alert tone="info">{state.notice}</Alert> : null}

      <div
        className={`flex flex-wrap items-end gap-3 ${
          live ? "justify-between" : "justify-end"
        }`}
      >
        {/* One form, two submit buttons: `formAction` is the same action and
            the button's own name/value says which kind to pull. Gone when the
            channel is off — the action refuses it anyway, and a button whose
            only outcome is an error is worse than no button. */}
        {live ? (
          <form action={formAction} className="space-y-1.5">
            <input type="hidden" name="channel" value={channel} />
            <input type="hidden" name="intent" value="sync" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
              Sync now
            </p>
            <div className="flex gap-2">
              <SyncButton kind="products">Products</SyncButton>
              <SyncButton kind="orders">Orders</SyncButton>
            </div>
          </form>
        ) : null}

        <DisconnectForm channel={channel} name={name} formAction={formAction} />
      </div>

      <p className="text-[12px] text-muted">
        {live
          ? `A sync runs on our side and can take a few minutes. Nothing is written back to ${name} — Alaiy only reads.`
          : `No new syncs will be started for ${name}. Nothing was ever written back to it — Alaiy only reads.`}
      </p>
    </div>
  );
}

function SyncButton({
  kind,
  children,
}: {
  kind: "products" | "orders";
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="kind"
      value={kind}
      disabled={pending}
      className={pressClass({ size: "sm" })}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

/**
 * Disconnect, behind a confirm step.
 *
 * Two clicks rather than `window.confirm`: the second click states what will
 * happen to the data, which a browser dialog cannot. It is a form either way,
 * so it still works before hydration.
 */
function DisconnectForm({
  channel,
  name,
  formAction,
}: {
  channel: ChannelId;
  name: string;
  formAction: (formData: FormData) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${pressClass({ ground: "quiet", size: "sm" })} hover:bg-alert-soft hover:text-alert-ink`}
      >
        Disconnect
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="intent" value="disconnect" />
      <p className="text-[12px] text-muted">
        Stop syncing {name}? Everything already imported stays.
      </p>
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={pressClass({ ground: "quiet", size: "sm" })}
      >
        Cancel
      </button>
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={pressClass({ ground: "alert", size: "sm" })}
    >
      {pending ? <Spinner /> : null}
      Yes, disconnect
    </button>
  );
}

function StatusPill({ status }: { status?: ConnectorStatus }) {
  const tone = !status?.connected ? "neutral" : status.error ? "alert" : "ok";

  const label = !status
    ? "Not connected"
    : status.connected
      ? status.error
        ? "Needs attention"
        : "Connected"
      : "Not connected";

  return <Pill tone={tone}>{label}</Pill>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-data font-medium text-ink">{value}</dd>
    </div>
  );
}
