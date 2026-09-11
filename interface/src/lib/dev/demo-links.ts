import type { ChannelId } from "@/lib/backend/types";

/**
 * Where a tab lives in the seller's own marketplace admin.
 *
 * The real backend resolves this host from the connection and sends it per
 * page, precisely so the frontend never guesses a marketplace domain. Demo
 * mode has one seller on Amazon.in, so it can answer — but it answers through
 * one module rather than by scattering the host through the fixtures, which is
 * what makes "no Amazon connected" a single change below.
 *
 * Null is a real answer and not a missing value: with no Amazon account the
 * mark is left off entirely rather than offering somewhere the seller cannot
 * go. `demo-backend` passes `connected: false` through for exactly that case.
 */

const HOST = "https://sellercentral.amazon.in";
const SHOP = "https://kavya-home-living.myshopify.com";

/** The Seller Central page above a tab's rows, per tab. */
const TABS: Record<string, string> = {
  orders: `${HOST}/orders-v3`,
  listings: `${HOST}/inventory`,
  inventory: `${HOST}/inventory`,
  "account-health": `${HOST}/performance/dashboard`,
  ratings: `${HOST}/feedback-manager`,
  profitability: `${HOST}/payments/reports`,
  shipping: `${HOST}/reportcentral/FulfilledShipments`,
};

export const sellerCentral = {
  tab: (name: keyof typeof TABS | string): string | null => TABS[name] ?? null,
  listing: (channel: ChannelId, sku: string): string =>
    channel === "amazon"
      ? `${HOST}/inventory/ref=xx_invmgr?sku=${sku}`
      : `${SHOP}/admin/products?query=${sku}`,
};
