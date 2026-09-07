import "server-only";
import { cache } from "react";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type { DashboardTiles } from "@/lib/backend/types";

/** Spec: the fixed tiles compare the last 7 days with the 7 before. */
export const HOME_WINDOW_DAYS = 7;

export type TilesResult =
  | { tiles: DashboardTiles; error?: undefined }
  | { tiles?: undefined; error: string };

/**
 * The four fixed Home tiles, in one backend call.
 *
 * Cached, and cached in its resolved form, because two places need these
 * numbers in the same render: the Home grid, and Ask Alaiy's opening message
 * in the surrounding layout. `cache` makes that one request rather than two.
 *
 * Returns the failure instead of throwing. A tiles outage should cost the
 * seller their numbers, not the whole shell — the sidebar, the panel and every
 * other tab still work without them.
 */
export const loadHomeTiles = cache(
  async (userToken?: string, days = HOME_WINDOW_DAYS): Promise<TilesResult> => {
    try {
      const tiles = await backend.get<DashboardTiles>(
        "/api/method/alaiy_os_self_serve_apis.api.dashboard.tiles",
        { query: { days }, userToken },
      );
      return { tiles };
    } catch (error) {
      return { error: userFacingError(error, OUR_FAULT) };
    }
  },
);
