import "server-only";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type {
  ChannelId,
  ChannelOrderDetail,
  FulfilmentFilter,
  OrderFlagKey,
  OrdersPage,
} from "@/lib/backend/types";

/**
 * The Orders tab's reads.
 *
 * A row is one *order*, grouped by the backend from the lines it is stored as,
 * flagged and ranked there too.
 *
 * The grouping happens in SQL rather than here, and that is not an
 * optimisation. An order's lines straddle a page boundary, so grouping a page
 * of lines in this process would show half an order at the bottom of page one,
 * rank "problems first" across only the fifty rows that happened to arrive,
 * and leave the header counting orders while the pager counted lines.
 */

const LIST = "/api/method/alaiy_os_self_serve_apis.api.orders.list_orders";
const DETAIL = "/api/method/alaiy_os_self_serve_apis.api.orders.order_detail";

/** Matches ORDER_SORTABLE in api/orders.py. */
export const ORDER_SORT_FIELDS = [
  // Not a column: the ranking the tab exists for — flagged orders first,
  // newest first inside that. Clicking a heading asks for something else.
  "attention",
  "order_date",
  "order_number",
  "channel",
  "customer_name",
  "order_total",
  "units",
  "line_count",
  "financial_status",
  "fulfillment_status",
  "last_synced_at",
] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export const PAGE_SIZE = 50;

/**
 * The ceiling on a CSV export, matching MAX_ORDER_PAGE_SIZE in api/orders.py.
 *
 * The export asks for the whole filtered view in one call rather than paging
 * it, so it needs a ceiling; past this the file is short and the route says so
 * rather than handing over a spreadsheet that quietly stops.
 */
export const EXPORT_LIMIT = 2000;

export type OrderQuery = {
  channel?: ChannelId;
  search?: string;
  /** A flag key, "attention" for everything above the line, or "clean". */
  flag?: OrderFlagKey | "attention" | "clean";
  fulfilment?: FulfilmentFilter;
  minAmount?: number;
  maxAmount?: number;
  fromDate?: string;
  /** A date, inclusive of the whole day — the backend widens it to midnight. */
  toDate?: string;
  start?: number;
  limit?: number;
  orderBy?: OrderSortField;
  order?: "asc" | "desc";
};

const EMPTY_TOTALS = {
  orders: 0,
  units: 0,
  attention: 0,
  currency: null,
  order_value: 0,
  merchandise_value: 0,
  mixed_currencies: false,
  by_currency: [],
};

const DEFAULT_RULES = {
  pending_payment_hours: 48,
  unshipped_hours: 48,
  fba_unshipped_hours: 72,
};

const EMPTY_ORDERS: OrdersPage = {
  rows: [],
  total: 0,
  start: 0,
  limit: PAGE_SIZE,
  totals: EMPTY_TOTALS,
  rules: DEFAULT_RULES,
};

export type OrdersResult = { page: OrdersPage; error?: string };

function backendQuery(query: OrderQuery) {
  return {
    channel: query.channel,
    search: query.search,
    flag: query.flag,
    fulfilment: query.fulfilment,
    min_amount: query.minAmount,
    max_amount: query.maxAmount,
    from_date: query.fromDate,
    to_date: query.toDate,
    start: query.start ?? 0,
    limit: query.limit ?? PAGE_SIZE,
    order_by: query.orderBy,
    order: query.order,
  };
}

/**
 * One page of orders, plus the totals for the whole filtered view.
 *
 * Same contract as listProducts: the failure travels with an empty page, so a
 * backend that is down renders the tab with a notice rather than an error
 * screen the seller can do nothing with.
 */
export async function listOrders(
  query: OrderQuery = {},
  userToken?: string,
): Promise<OrdersResult> {
  try {
    const page = await backend.get<OrdersPage | null>(LIST, {
      query: backendQuery(query),
      userToken,
    });
    return { page: page ?? EMPTY_ORDERS };
  } catch (error) {
    return { page: EMPTY_ORDERS, error: userFacingError(error, OUR_FAULT) };
  }
}

/**
 * One order and every line on it.
 *
 * Null rather than an error when it cannot be read: the detail panel is a
 * sidecar to a table that is already on screen, and losing it should not take
 * the table with it.
 */
export async function getOrderDetail(
  channel: ChannelId,
  externalOrderId: string,
  userToken?: string,
): Promise<ChannelOrderDetail | null> {
  try {
    const order = await backend.get<ChannelOrderDetail | null>(DETAIL, {
      query: { channel, external_order_id: externalOrderId },
      userToken,
    });
    return order ?? null;
  } catch {
    return null;
  }
}

// The line grain and the per-channel window summary are deliberately not
// wrapped. The tab reads whole orders now, and its figures come off
// `listOrders` — which knows what the filters have narrowed the view to, so it
// cannot disagree with the rows underneath the way a second query could. Both
// backend methods stay whitelisted for a caller that wants a row per SKU;
// nothing here is one.
