import "server-only";
import { cache } from "react";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type { HomeDashboard } from "@/lib/backend/types";

/**
 * The Home dashboard's reads.
 *
 * One call for the four tiles and the alert bar together, because the alerts
 * are the tiles crossing a threshold — the return-rate spike and the sales
 * drop are computed from the same aggregates the tiles show. Splitting them
 * would mean either running those aggregates twice or letting a tile and the
 * alert about it quote different numbers.
 *
 * Recent orders and per-channel sync freshness are *not* here. Both already
 * have a reader that answers them exactly — `listOrders` at the order grain
 * with its flags, and `listConnectors` — and a second copy of either would be
 * a second definition of "flagged" or of "last synced" to keep in step.
 */

const HOME = "/api/method/alaiy_os_self_serve_apis.api.dashboard.home";
const DISMISS = "/api/method/alaiy_os_self_serve_apis.api.dashboard.dismiss_alert";

export type HomeResult =
  | { dashboard: HomeDashboard; error?: undefined }
  | { dashboard?: undefined; error: string };

/**
 * The tiles and the alert bar.
 *
 * Returns the failure instead of throwing, and cached for the request the same
 * way `loadHomeTiles` is: Home renders the conversation above the dashboard,
 * and an outage on the numbers should cost the seller the numbers, not the
 * composer and the rest of the shell with them.
 */
export const loadHomeDashboard = cache(
  async (userToken?: string): Promise<HomeResult> => {
    try {
      const dashboard = await backend.get<HomeDashboard | null>(HOME, { userToken });
      if (!dashboard) return { error: OUR_FAULT };
      return {
        dashboard: {
          ...dashboard,
          // A backend that ships an alert-engine failure as a null must not
          // take `.map` down with it — the tiles are still worth rendering.
          alerts: dashboard.alerts ?? [],
        },
      };
    } catch (error) {
      return { error: userFacingError(error, OUR_FAULT) };
    }
  },
);

/**
 * Hide one alert until it changes, or clears and comes back.
 *
 * The fingerprint is the one the seller was looking at, sent back so the
 * dismissal cannot silence a worse version of the same alert that arrived
 * between the render and the click.
 */
export async function dismissHomeAlert(
  key: string,
  fingerprint: string,
  userToken?: string,
): Promise<void> {
  await backend.post(DISMISS, { key, fingerprint }, { userToken });
}
