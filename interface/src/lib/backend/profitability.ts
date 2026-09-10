import "server-only";
import { cache } from "react";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type { PnlPage } from "@/lib/profitability/types";

/**
 * The Profitability tab's reads.
 *
 * One endpoint, because the table, the Buy Box panel and the header's caveats
 * are three readings of the same rows — fetching them separately would query
 * the same four sources twice and let the panel disagree with the table it is
 * drawn from about a SKU's win rate.
 *
 * No workspace is passed. `require_workspace()` derives it from the session on
 * the backend, so there is no parameter through which a caller could ask for
 * another seller's margins.
 */

const API = "/api/method/alaiy_os_self_serve_apis.api.profitability";

/** The tab's default reporting window. Matches WINDOW_DAYS on the backend. */
export const WINDOW_DAYS = 30;

/** What the period selector offers. Bounded by the backend at a year. */
export const WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

/**
 * An empty page, for the failure path.
 *
 * Every coverage flag is false, which is the honest reading of a call that did
 * not answer: we do not know that this seller has fee data, only that we could
 * not ask. The tab renders its shell and the error rather than an empty table
 * that looks like a seller with no sales.
 */
const EMPTY: PnlPage = {
  days: WINDOW_DAYS,
  rows: [],
  coverage: {
    amazon_connected: false,
    shopify_connected: false,
    amazon_skus: 0,
    shopify_skus: 0,
    has_settled_fees: false,
    has_fee_data: false,
    has_buy_box: false,
    shopify_fees_available: false,
    synced_at: null,
    cogs_available: false,
    shipping_cost_available: false,
  },
  currency: null,
};

export type PnlResult = { page: PnlPage; error?: string };

/**
 * Margin per SKU over a window.
 *
 * Returns its failure alongside an empty page rather than throwing, like every
 * other reader here: a fee outage should cost the seller these numbers, not the
 * shell around them and the period they had selected.
 */
export const loadProfitability = cache(
  async (days?: number, userToken?: string): Promise<PnlResult> => {
    try {
      const page = await backend.get<PnlPage | null>(`${API}.overview`, {
        query: { days },
        userToken,
      });
      if (!page) return { page: EMPTY, error: OUR_FAULT };
      return { page: { ...page, rows: page.rows ?? [] } };
    } catch (error) {
      return { page: EMPTY, error: userFacingError(error, OUR_FAULT) };
    }
  },
);

/**
 * Queue a fresh pull of fees and Buy Box standing.
 *
 * Returns as soon as the backend has queued it, and the seller is told that
 * rather than that new numbers have arrived — the Sales & Traffic report is a
 * request, a poll and a download on a worker, and the fee quotes are paced.
 */
export async function refreshProfitability(
  userToken?: string,
): Promise<{ queued: boolean; job: string }> {
  return backend.post(`${API}.refresh`, {}, { userToken });
}
