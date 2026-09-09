import type { ChannelId } from "@/lib/backend/types";

/**
 * Channel catalogue. Only Shopify and Amazon are live in V1 — the rest are
 * listed so sellers can see they are coming, but cannot be selected.
 */

export type ChannelDefinition = {
  id: ChannelId;
  name: string;
  blurb: string;
  /** Walkthrough shown inline on the connect step. */
  helpVideoUrl: string;
  helpVideoPoster?: string;
};

export const CHANNELS: ChannelDefinition[] = [
  // {
  //   id: "shopify",
  //   name: "Shopify",
  //   blurb: "Orders, products, inventory and payouts. Real-time via webhooks.",
  //   helpVideoUrl: "https://cdn.alaiy.com/help/connect-shopify.mp4",
  // },
  {
    id: "amazon",
    name: "Amazon",
    blurb: "Orders, inventory and settlements over SP-API.",
    helpVideoUrl: "https://cdn.alaiy.com/help/connect-amazon.mp4",
  },
];

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

/** Client-safe label for the backfill window. See IMPORT_WINDOW_DAYS. */
export const IMPORT_WINDOW_DAYS_LABEL = "90 days";
