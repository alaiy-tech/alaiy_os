import type { ChannelId } from "@/lib/backend/types";

/**
 * Channel catalogue.
 *
 * Every channel the app has a name for is listed here, switched off ones
 * included. That is deliberate: `channelName` reads this list, and a workspace
 * that imported from a channel before it was turned off still has orders,
 * listings and stock rows that need labelling. Dropping an entry would render
 * those as a raw id.
 *
 * What `live` governs is whether a seller can *attach* the channel and whether
 * it is offered as a filter — not whether the app is allowed to name it.
 */

export type ChannelDefinition = {
  id: ChannelId;
  name: string;
  blurb: string;
  /**
   * Connectable today.
   *
   * Off removes the channel from onboarding, from the Channels tab and from
   * every channel filter, and makes its connect action refuse a direct post.
   * It deliberately does not hide an existing connection: that card stays, so
   * a store attached while the channel was live can still be disconnected.
   */
  live: boolean;
  /** Walkthrough shown inline on the connect step. */
  helpVideoUrl: string;
  helpVideoPoster?: string;
};

export const CHANNELS: ChannelDefinition[] = [
  {
    id: "shopify",
    name: "Shopify",
    blurb: "Orders, products, inventory and payouts. Real-time via webhooks.",
    live: false,
    helpVideoUrl: "https://cdn.alaiy.com/help/connect-shopify.mp4",
  },
  {
    id: "amazon",
    name: "Amazon",
    blurb: "Orders, inventory and settlements over SP-API.",
    live: true,
    helpVideoUrl: "https://cdn.alaiy.com/help/connect-amazon.mp4",
  },
];

/** The catalogue as far as a seller is concerned: what they can connect. */
export const LIVE_CHANNELS = CHANNELS.filter((channel) => channel.live);

/** Ids alone, for the server actions that validate a posted channel. */
export const CHANNEL_IDS: ChannelId[] = CHANNELS.map((channel) => channel.id);
export const LIVE_CHANNEL_IDS: ChannelId[] = LIVE_CHANNELS.map((channel) => channel.id);

/** A channel this app knows about, live or not. */
export function isChannel(value: string): value is ChannelId {
  return CHANNEL_IDS.some((id) => id === value);
}

/** A channel a seller is allowed to act on. */
export function isLiveChannel(value: string): value is ChannelId {
  return LIVE_CHANNEL_IDS.some((id) => id === value);
}

/**
 * Options for a channel filter, without the leading "all" entry — screens word
 * that differently ("All", "All channels") and it is not a channel.
 */
export function channelOptions(): { value: ChannelId; label: string }[] {
  return LIVE_CHANNELS.map((channel) => ({ value: channel.id, label: channel.name }));
}

/**
 * Listed on the connect step but not connectable yet.
 *
 * They are rows rather than a footnote because the step now answers "what can
 * Alaiy read from?" in one place, and a seller on WooCommerce deserves to see
 * their platform named rather than to conclude it is unsupported.
 */
export const UPCOMING_CHANNELS: { name: string; blurb: string }[] = [
  { name: "BigCommerce", blurb: "Storefront orders and catalogue." },
  { name: "WooCommerce", blurb: "WordPress storefronts." },
  { name: "Unicommerce", blurb: "Warehouse and inventory sync." },
];

export function channelName(id: ChannelId): string {
  return CHANNELS.find((c) => c.id === id)?.name ?? id;
}

/**
 * Client-safe label for the part of the import a seller waits for, not for
 * how much history they get — they get all of it. Onboarding completes on the
 * recent window and the rest keeps landing behind them, so this labels the
 * wait. See IMPORT_WINDOW_DAYS.
 */
export const IMPORT_RECENT_WINDOW_LABEL = "90 days";
