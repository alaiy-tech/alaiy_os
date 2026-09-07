import "server-only";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type {
  ChannelId,
  ChannelProduct,
  InventorySummaryRow,
  Paged,
} from "@/lib/backend/types";

/**
 * The Inventory tab's reads.
 *
 * Every filter is passed to the backend rather than applied here: the seller's
 * catalogue can be tens of thousands of rows across two channels, and paging
 * in the database is the only version of this that stays fast. The workspace
 * scope is *not* passed — `require_workspace()` derives it from the session on
 * the backend, so there is no parameter a caller could tamper with.
 */

const LIST = "/api/method/alaiy_os_self_serve_apis.api.inventory.list_products";
const SUMMARY = "/api/method/alaiy_os_self_serve_apis.api.inventory.summary";

/** Matches api/inventory.py's SORTABLE. Anything else the backend ignores. */
export const PRODUCT_SORT_FIELDS = [
  "sku",
  "title",
  "channel",
  "status",
  "price",
  "available_qty",
  "last_synced_at",
  "inventory_updated_at",
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const PAGE_SIZE = 50;

export type ProductQuery = {
  channel?: ChannelId;
  search?: string;
  start?: number;
  limit?: number;
  orderBy?: ProductSortField;
  order?: "asc" | "desc";
};

const EMPTY: Paged<ChannelProduct> = { rows: [], total: 0, start: 0, limit: PAGE_SIZE };

export type ProductsResult = { page: Paged<ChannelProduct>; error?: string };

/**
 * Returns the failure alongside an empty page instead of throwing.
 *
 * The table, its filters and the summary are three calls on one screen. A
 * seller whose catalogue read fails should still get the shell, the filters
 * they typed and a sentence about what went wrong — not an error page that
 * loses their query.
 */
export async function listProducts(
  query: ProductQuery = {},
  userToken?: string,
): Promise<ProductsResult> {
  try {
    const page = await backend.get<Paged<ChannelProduct> | null>(LIST, {
      query: {
        channel: query.channel,
        search: query.search,
        start: query.start ?? 0,
        limit: query.limit ?? PAGE_SIZE,
        order_by: query.orderBy,
        order: query.order,
      },
      userToken,
    });
    return { page: page ?? EMPTY };
  } catch (error) {
    return { page: EMPTY, error: userFacingError(error, OUR_FAULT) };
  }
}

/** Per-channel product and unit counts. Empty on failure — it is a header. */
export async function inventorySummary(
  userToken?: string,
): Promise<InventorySummaryRow[]> {
  try {
    return (await backend.get<InventorySummaryRow[] | null>(SUMMARY, { userToken })) ?? [];
  } catch {
    return [];
  }
}
