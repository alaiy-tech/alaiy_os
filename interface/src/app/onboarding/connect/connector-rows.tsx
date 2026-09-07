"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { connectAmazonAction, connectShopifyAction, type FormState } from "../actions";
import { VideoHelper } from "@/components/onboarding/video-helper";
import { Alert, Field, Input, Pill, Select, Spinner, pressClass } from "@/components/ui";
import { AMAZON_REGIONS } from "@/lib/auth/amazon-regions";
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
 * private-app token the seller pastes, which cannot be a single click, so its
 * button opens the two fields underneath. Both post to Server Actions, so
 * credentials go browser -> our server -> the connector and never cross an
 * origin.
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
          <VideoHelper
            title={`How to connect ${channel.name}`}
            src={channel.helpVideoUrl}
            poster={channel.helpVideoPoster}
          />
        </div>
      )}
    </div>
  );
}

function ShopifyForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    connectShopifyAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Store domain">
        <Input
          name="shop"
          placeholder="your-store.myshopify.com"
          autoComplete="off"
          required
        />
      </Field>

      <Field
        label="Admin API access token"
        hint="Shopify admin → Settings → Apps → Develop apps → your app → Admin API access token."
      >
        <Input
          name="access_token"
          type="password"
          placeholder="shpat_..."
          autoComplete="off"
          required
        />
      </Field>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <RowSubmit className={`${ACTION} w-full sm:w-auto`}>Connect Shopify</RowSubmit>
    </form>
  );
}

/**
 * Amazon's action: region, then straight out to Seller Central.
 *
 * The region cannot be dropped to make this a lone button. Consent starts on a
 * region-specific Seller Central domain, so a European seller sent to the North
 * American one simply cannot sign in — and we have nothing to guess from before
 * they are authorised. Inline beside the button keeps it one click.
 */
function AmazonAction({
  ready,
  unavailable,
}: {
  ready: boolean;
  unavailable: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    connectAmazonAction,
    {},
  );

  // Said before the not-configured case, because "we could not check" must
  // never be reported as "it is not set up" — that points at the wrong thing.
  if (unavailable) {
    return (
      <p className="text-[12px] text-warn-ink">
        Couldn&apos;t check availability — that&apos;s on our side.
      </p>
    );
  }

  if (!ready) {
    return (
      <p className="text-[12px] text-muted">
        Not configured on this environment yet.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="amazon-region">
        Your Amazon region
      </label>
      <Select
        id="amazon-region"
        name="region"
        defaultValue="NA"
        className="h-9 w-auto text-[13px]"
        options={AMAZON_REGIONS.map((region) => ({
          value: region.spapi,
          label: region.label,
        }))}
      />

      <RowSubmit className={ACTION}>Connect</RowSubmit>

      {state.error ? (
        <p className="basis-full text-[12px] text-alert-ink">{state.error}</p>
      ) : null}
    </form>
  );
}

function RowSubmit({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? <Spinner /> : null}
      {children}
    </button>
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
