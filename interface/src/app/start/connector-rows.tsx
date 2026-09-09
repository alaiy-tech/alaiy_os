"use client";

import { useState } from "react";
import { VideoHelper } from "@/components/onboarding/video-helper";
import { AmazonAction } from "@/components/connect/amazon-action";
import { ShopifyForm } from "@/components/connect/shopify-form";
import { Pill, pressClass } from "@/components/ui";
import type { ChannelDefinition } from "@/lib/channels";
import type { ConnectorStatus } from "@/lib/backend/types";

/**
 * The connect step, one row per connector.
 *
 * Picking channels and connecting them used to be two screens, which meant
 * saying "Amazon" on the first one and then proving it on the second. A row per
 * connector collapses that: the list *is* the catalogue, and connecting is the
 * only answer it asks for.
 *
 * The two live channels do not connect the same way, and the rows admit it.
 * Amazon is OAuth, so its button leaves for Seller Central. Shopify in V1 is a
 * custom app the seller makes in their own admin, so what it needs is that
 * app's Client ID and Secret — which cannot be a single click, so its button
 * opens the fields underneath. Both post to Server Actions, so credentials go
 * browser -> our server -> the connector and never cross an origin.
 */

/**
 * Row-scale controls. `size: "sm"` is a real size in the press system rather
 * than an `h-9` appended to the form-scale one, so which height wins is a
 * decision here and not an accident of stylesheet order.
 *
 * Connect and Cancel are the same shape, because they are the same shape
 * everywhere — the row says which is which by what it reads, not by weight.
 */
const ACTION = `${pressClass({ size: "sm" })} shrink-0`;
const ACTION_QUIET = `${pressClass({ ground: "quiet", size: "sm" })} shrink-0`;

export function ConnectorRows({
  channels,
  statuses,
  amazonReady,
  amazonUnavailable,
}: {
  channels: ChannelDefinition[];
  statuses: ConnectorStatus[];
  amazonReady: boolean;
  /** The readiness check itself failed, so we do not know either way. */
  amazonUnavailable: boolean;
}) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-sm border border-line bg-white">
      {channels.map((channel) => (
        <ConnectorRow
          key={channel.id}
          channel={channel}
          status={statuses.find((s) => s.channel === channel.id)}
          amazonReady={amazonReady}
          amazonUnavailable={amazonUnavailable}
        />
      ))}
    </div>
  );
}

function ConnectorRow({
  channel,
  status,
  amazonReady,
  amazonUnavailable,
}: {
  channel: ChannelDefinition;
  status?: ConnectorStatus;
  amazonReady: boolean;
  amazonUnavailable: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const connected = Boolean(status?.connected);

  return (
    <div className="p-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-display-sm">{channel.name}</h2>
            {connected ? <Pill tone="ok">Connected</Pill> : null}
          </div>
          <p className="text-[13px] text-muted">
            {connected ? (
              <>
                Connected as{" "}
                <span className="font-medium text-ink">
                  {status?.account_label ?? channel.name}
                </span>
                .
              </>
            ) : (
              channel.blurb
            )}
          </p>
        </div>

        {connected ? null : channel.id === "amazon" ? (
          <AmazonAction ready={amazonReady} unavailable={amazonUnavailable} />
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className={expanded ? ACTION_QUIET : ACTION}
          >
            {expanded ? "Cancel" : "Connect"}
          </button>
        )}
      </div>

      {/* Shopify's credentials, plus the walkthrough for whichever channel this
          is. Collapsed, so it costs a line until someone wants it — and gone
          once the channel is connected, when instructions are just noise. */}
      {connected ? null : (
        <div className="mt-3 space-y-4">
          {channel.id === "shopify" && expanded ? (
            <div className="space-y-4 border-t border-line pt-4">
              <ShopifyForm />
            </div>
          ) : null}
          {/* <VideoHelper
            title={`How to connect ${channel.name}`}
            src={channel.helpVideoUrl}
            poster={channel.helpVideoPoster}
          /> */}
        </div>
      )}
    </div>
  );
}

/** Named so sellers on them know they are on the roadmap, not unsupported. */
export function UpcomingRows({
  channels,
}: {
  channels: { name: string; blurb: string }[];
}) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-sm border border-line bg-surface">
      {channels.map((channel) => (
        <div
          key={channel.name}
          className="flex items-center justify-between gap-4 px-5 py-3.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">{channel.name}</p>
            <p className="text-[13px] text-muted-soft">{channel.blurb}</p>
          </div>
          <Pill tone="neutral">Soon</Pill>
        </div>
      ))}
    </div>
  );
}
