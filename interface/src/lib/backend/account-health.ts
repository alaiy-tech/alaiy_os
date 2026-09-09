import "server-only";
import { cache } from "react";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type {
  AccountHealth,
  ContributingOrders,
  HealthTrend,
} from "@/lib/backend/types";

/**
 * The Account Health tab's reads.
 *
 * Amazon only, because Shopify has no account-suspension mechanism — there is
 * no equivalent metric to show and nothing to reconcile between the two.
 *
 * None of these takes a workspace. The backend derives it from the session and
 * offers no parameter to name another seller's, which matters more here than
 * anywhere else in the app: these are the numbers that decide whether a
 * business stays open. See the module docstring on `api/account_health.py`.
 */

const API = "/api/method/alaiy_os_self_serve_apis.api.account_health";

/** The spec's window for the trend chart. */
export const TREND_DAYS = 60;

export type AccountHealthResult =
  | { health: AccountHealth; error?: undefined }
  | { health?: undefined; error: string };

/**
 * The banner, the tiles, the late-shipment outlook and the gaps.
 *
 * Cached for the request because the page reads it and so does the metric the
 * URL has expanded — one call, not two.
 *
 * Returns its failure rather than throwing, like every other reader here: a
 * health outage should cost the seller these numbers, not the shell around
 * them.
 */
export const loadAccountHealth = cache(
  async (userToken?: string): Promise<AccountHealthResult> => {
    try {
      const health = await backend.get<AccountHealth | null>(`${API}.overview`, {
        userToken,
      });
      if (!health) return { error: OUR_FAULT };
      return {
        health: { ...health, metrics: health.metrics ?? [], gaps: health.gaps ?? [] },
      };
    } catch (error) {
      return { error: userFacingError(error, OUR_FAULT) };
    }
  },
);

/**
 * The stored readings for the chart.
 *
 * Null on failure rather than an error string: the chart is the one part of
 * this tab that is history rather than a live number, and losing it should not
 * put a notice above tiles that loaded perfectly well.
 */
export const loadHealthTrend = cache(
  async (userToken?: string, days = TREND_DAYS): Promise<HealthTrend | null> => {
    try {
      const trend = await backend.get<HealthTrend | null>(`${API}.trend`, {
        query: { days },
        userToken,
      });
      return trend?.rows ? trend : null;
    } catch {
      return null;
    }
  },
);

/**
 * The orders behind one metric.
 *
 * Only fetched when the URL has a metric expanded, so an unopened tile costs
 * nothing.
 */
export async function loadContributingOrders(
  metricKey: string,
  userToken?: string,
): Promise<ContributingOrders | null> {
  try {
    const result = await backend.get<ContributingOrders | null>(`${API}.contributing`, {
      query: { metric_key: metricKey },
      userToken,
    });
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Queue a fresh pull.
 *
 * Returns as soon as the backend has queued it, and the seller is told that
 * rather than that new numbers have arrived — the performance report is a
 * request, a poll and a download on a worker.
 */
export async function refreshAccountHealth(
  userToken?: string,
): Promise<{ queued: boolean; job: string }> {
  return backend.post(`${API}.refresh`, {}, { userToken });
}
