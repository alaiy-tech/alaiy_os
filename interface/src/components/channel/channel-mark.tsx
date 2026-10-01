import { channelName } from "@/lib/channels";
import type { ChannelId } from "@/lib/backend/types";

/**
 * A channel at a glance, where there is no room to spell it out.
 *
 * **Not the marketplace's logo.** Shipping Amazon's, Shopify's and Myntra's
 * trademarks inside the product would be a brand-usage decision rather than a
 * design one, and the app does not hold a licensed asset for any of them —
 * `seller-central.webp` is the single exception, and it exists specifically to
 * mark the way *out* to Seller Central. So this is the channel's initial on
 * the channel's own colour: the same hues `ChannelBadge` already teaches down
 * the Orders table, so a seller who has learnt that orange is Amazon there
 * reads it here without being told twice.
 *
 * Always paired with the name, either beside it or through `title` plus the
 * caller's own screen-reader text — a coloured letter is a reminder, never the
 * only way to know which store a figure belongs to.
 */

const TONES: Record<string, string> = {
  shopify: "bg-ok-soft text-ok-ink",
  amazon: "bg-warn-soft text-warn-ink",
  myntra: "bg-alert-soft text-alert-ink",
  flipkart: "bg-highlight-100 text-highlight-700",
  nykaa: "bg-primary-100 text-primary-600",
  ajio: "bg-surface text-muted",
};

const SIZES = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-8 w-8 text-[13px]",
} as const;

export function ChannelMark({
  channel,
  size = "md",
}: {
  channel: ChannelId;
  size?: keyof typeof SIZES;
}) {
  const name = channelName(channel);
  return (
    <span
      aria-hidden
      title={name}
      className={`grid shrink-0 place-items-center rounded-xs font-sans font-bold ${
        SIZES[size]
      } ${TONES[channel] ?? "bg-surface text-muted"}`}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
