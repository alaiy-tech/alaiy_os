import "server-only";
import { cache } from "react";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type { ShippingPage } from "@/lib/shipping/types";

/**
 * The Shipping tab's reads.
 *
 * One endpoint, because the tiles, the trend, the carrier table and the late
 * lists are four readings of the same parcels over the same window. Splitting
 * them would query that table four times and let a tile disagree with the
 * chart beneath it about the same average.
 *
 * No workspace is passed. `require_workspace()` derives it from the session on
 * the backend, so there is no parameter through which a caller could ask for
 * another seller's shipments.
 */

const API = "/api/method/alaiy_os_self_serve_apis.api.shipping";

/** The tab's default window. Matches WINDOW_DAYS on the backend. */
export const WINDOW_DAYS = 30;

export const WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

const EMPTY_METRIC = { value: null, previous: null, measured: null, total: null };

/**
 * An empty page, for the failure path.
 *
 * Every figure null and every coverage flag false — the honest reading of a
 * call that did not answer. We do not know this seller shipped nothing, only
 * that we could not ask, and a page of zeroes would say the first.
 */
const EMPTY: ShippingPage = {
  days: WINDOW_DAYS,
  summary: {
    avg_handling_hours: EMPTY_METRIC,
    on_time_dispatch_pct: EMPTY_METRIC,
    on_time_delivery_pct: EMPTY_METRIC,
    late_shipment_rate_pct: { ...EMPTY_METRIC, as_of: null, source: "amazon_account_health" },
    threshold: 4,
    packages: 0,
  },
  handling_time_trend: [],
  carriers: [],
  late_shipments: { at_risk: [], shipped_late: [], scope: "amazon_merchant_fulfilled" },
  coverage: {
    amazon_connected: false,
    shopify_connected: false,
    packages: 0,
    seller_fulfilled: 0,
    amazon_fulfilled: 0,
    shopify_packages: 0,
    has_fba_shipments: false,
    has_deliveries: false,
    synced_at: null,
  },
};

export type ShippingResult = { page: ShippingPage; error?: string };

/**
 * Fulfilment health over a window.
 *
 * Returns its failure alongside an empty page rather than throwing, like every
 * other reader here: an outage should cost the seller these numbers, not the
 * shell around them and the period they had selected.
 */
export const loadShipping = cache(
  async (days?: number, userToken?: string): Promise<ShippingResult> => {
    try {
      const page = await backend.get<ShippingPage | null>(`${API}.overview`, {
        query: { days },
        userToken,
      });
      if (!page) return { page: EMPTY, error: OUR_FAULT };
      return {
        page: {
          ...page,
          handling_time_trend: page.handling_time_trend ?? [],
          carriers: page.carriers ?? [],
          late_shipments: page.late_shipments ?? EMPTY.late_shipments,
        },
      };
    } catch (error) {
      return { page: EMPTY, error: userFacingError(error, OUR_FAULT) };
    }
  },
);

/**
 * Queue a fresh pull of Amazon's parcels.
 *
 * Returns as soon as it is queued: the merchant half is one Amazon call per
 * order and the FBA half is a report request, a poll and a download. Shopify
 * needs no refresh — its fulfilments arrive with the ordinary orders sync.
 */
export async function refreshShipping(
  userToken?: string,
): Promise<{ queued: boolean; job: string }> {
  return backend.post(`${API}.refresh`, {}, { userToken });
}
