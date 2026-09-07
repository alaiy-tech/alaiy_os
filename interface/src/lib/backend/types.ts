/**
 * The contract this app expects from the Alaiy OS (ERPNext) backend at
 * os.alaiy.com. Endpoint paths live beside each call in the modules under
 * src/lib/backend/ — change them there if the backend names differ.
 */

export type BackendUser = {
  id: string;
  email: string;
  name?: string;
  photo_url?: string;
};

export type BackendWorkspace = {
  /** ERPNext Company name. Scopes every query for this workspace. */
  id: string;
  company_name?: string;
  tier: "free" | "growth" | "enterprise";
  /** Provisioning is async; the spec targets under 60 seconds. */
  status: "provisioning" | "ready" | "failed";
  profile_complete: boolean;
  /**
   * True once this seller has been through onboarding. Persisted on the
   * workspace, so a new sign-in never restarts the flow — the step used to be
   * derived from `profile_complete` alone, which can only say "profile" or
   * "channels", and walked every returning seller through it again.
   */
  onboarding_complete?: boolean;
  /** When an order counts as a problem. See OrderFlagRules. */
  flag_rules?: OrderFlagRules;
};

export type AuthResult = {
  user: BackendUser;
  workspace: BackendWorkspace;
  /** Per-user ERPNext token for subsequent scoped calls. */
  token?: string;
};

export type ChannelId = "shopify" | "amazon";

export type ConnectorStatus = {
  channel: ChannelId;
  connected: boolean;
  /** Shop domain for Shopify, selling-partner id for Amazon. */
  account_label?: string;
  marketplace?: string;
  last_synced_at?: string;
  error?: string;
};

export type ImportStepId = "orders" | "inventory" | "settlements";

export type ImportStep = {
  id: ImportStepId;
  channel: ChannelId;
  status: "pending" | "running" | "done" | "failed";
  /** Records written so far, for the progress screen. */
  processed: number;
  total?: number;
  error?: string;
};

export type ImportJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  /** 0–100, computed by the backend across all steps. */
  progress: number;
  steps: ImportStep[];
  started_at?: string;
  completed_at?: string;
};

/* --- Home screen tiles ------------------------------------------------- */

/**
 * A tile's number plus the same number for the preceding window of equal
 * length. `change_pct` is null when there was no prior data to compare
 * against — growth from nothing has no meaningful percentage.
 */
export type TileMetric = {
  value: number;
  previous: number;
  change_pct: number | null;
};

export type ReturnRateMetric = {
  /** Share of orders, as a percentage. */
  value: number;
  previous: number;
  /** Percentage *points* between the two rates, not percent. */
  change_pp: number;
  returned_orders: number;
  /**
   * Neither channel exposes RMA returns to us, so this is refunds plus
   * cancellations. The tile says so rather than overclaiming.
   */
  basis: "refunds_and_cancellations";
};

export type UnsettledMetric = {
  /** False until settlements sync exists; no fake zero is shown. */
  available: boolean;
  value: number | null;
  overdue_count: number | null;
  reason?: string;
};

export type DashboardWindow = {
  days: number;
  from: string;
  to: string;
  compare_from: string;
  compare_to: string;
};

export type DashboardTiles = {
  window: DashboardWindow;
  /** The currency carrying the most revenue, or null when nothing sold. */
  currency: string | null;
  /** True when channels report in more than one currency — see the note in dashboard.py. */
  mixed_currencies: boolean;
  /** Distinguishes "nothing sold this week" from "nothing imported yet". */
  has_any_orders: boolean;
  gmv: TileMetric;
  orders: TileMetric;
  return_rate: ReturnRateMetric;
  unsettled: UnsettledMetric;
};

/* --- Orders and Inventory tabs ----------------------------------------- */

/**
 * One page of a listing. `total` is the count matching the filters, not the
 * page length, so the pager can say "51–100 of 2,304".
 */
export type Paged<Row> = {
  rows: Row[];
  total: number;
  start: number;
  limit: number;
};

/**
 * A product as one channel reports it — the grain is (product, channel), so a
 * SKU listed on both Shopify and Amazon is two rows. That is deliberate: the
 * price and the stock figure are per channel, and averaging them would invent
 * a number neither channel would agree with.
 */
export type ChannelProduct = {
  name: string;
  channel: ChannelId;
  sku?: string;
  title?: string;
  /**
   * Whatever the channel calls it — "ACTIVE" from Shopify, its own vocabulary
   * from Amazon. Passed through rather than mapped onto a shared set, because
   * the two do not mean the same things. Display-only for that reason.
   */
  status?: string;
  price?: number;
  currency?: string;
  available_qty?: number;
  external_product_id?: string;
  external_variant_id?: string;
  external_url?: string;
  image_url?: string;
  inventory_updated_at?: string;
  last_synced_at?: string;
};

/**
 * An order *line*, with the order-level fields repeated on each one. This is
 * the backend's agreed grain (see api/orders.py) — it makes per-SKU questions
 * a plain query, at the cost of an order total that repeats down its lines.
 * The Orders table therefore counts distinct orders separately from rows.
 */
export type ChannelOrderItem = {
  name: string;
  channel: ChannelId;
  external_order_id?: string;
  order_number?: string;
  order_date?: string;
  order_status?: string;
  /** Channel vocabulary, unmapped — see the note on ChannelProduct.status. */
  financial_status?: string;
  /** Shopify sends a real status here; Amazon sends AFN/MFN, its fulfilment
   *  channel. Another reason these are shown rather than filtered on. */
  fulfillment_status?: string;
  customer_name?: string;
  currency?: string;
  order_total?: number;
  sku?: string;
  external_line_id?: string;
  product_title?: string;
  qty?: number;
  unit_price?: number;
  line_total?: number;
  tax_amount?: number;
  discount_amount?: number;
  last_synced_at?: string;
};

/**
 * A whole order, assembled by the backend from its lines.
 *
 * The grain the Orders tab shows. `order_total` is the order's own total as
 * the channel reported it — the backend takes it with `max()`, because it is
 * repeated down every line — while `merchandise_total` is the sum of the
 * lines, which is the figure the Home tiles call GMV. The two differ by tax
 * and shipping, which is why they have different names.
 */
export type ChannelOrder = {
  channel: ChannelId;
  external_order_id: string;
  /** Shopify's "#1001"; for Amazon this is the Amazon order id itself. */
  order_number?: string;
  order_date?: string;
  /** Channel vocabulary, unmapped — see the note on ChannelProduct.status. */
  order_status?: string;
  financial_status?: string;
  /** Shopify sends a real status; Amazon sends AFN/MFN, its fulfilment
   *  channel. Which is what makes the FBA/self-ship split real. */
  fulfillment_status?: string;
  customer_name?: string;
  currency?: string;
  order_total?: number;
  merchandise_total?: number;
  units?: number;
  line_count?: number;
  skus: string[];
  last_synced_at?: string;
  /** Every flag this order trips, computed server-side. See OrderFlagKey. */
  flags: OrderFlagKey[];
  /** The loudest flag's weight, which is what "problems first" sorts on. */
  severity: number;
  needs_attention: boolean;
  /** This order in the seller's own Shopify admin or Seller Central. Null
   *  when the connection cannot supply a shop domain or a marketplace. */
  external_url: string | null;
};

/**
 * The five things that make an order a problem, defined by the backend in
 * `selfserve/order_flags.py`.
 *
 * These are the first vocabulary the two channels share. Their raw statuses
 * are still passed through unmapped, because Shopify's words and Amazon's do
 * not line up — but a flag is ours, means the same on both sides, and is
 * therefore something a filter can honestly offer.
 */
export type OrderFlagKey =
  | "unfulfillable"
  | "payment_pending"
  | "stuck"
  | "refunded"
  | "cancelled";

/**
 * How an order may be filtered by what it shipped from.
 *
 * Amazon's AFN is FBA; MFN and every Shopify order are the seller's own to
 * ship. It is the one fulfilment fact the two channels genuinely share.
 */
export type FulfilmentFilter = "fba" | "merchant";

/** Hours, per workspace, after which an order is flagged. */
export type OrderFlagRules = {
  pending_payment_hours: number;
  /** Shopify and Amazon MFN — everything the seller ships themselves. */
  unshipped_hours: number;
  /** Amazon's own warehouse (AFN), which the seller cannot hurry. */
  fba_unshipped_hours: number;
};

/**
 * The figures above the table, for exactly the rows it is showing.
 *
 * Money is the dominant currency's own rather than a sum across currencies: a
 * seller can hold a Shopify store in one and an Amazon marketplace in another,
 * and adding those produces a number that is true of nothing. Counts do add up.
 */
export type OrderTotals = {
  orders: number;
  units: number;
  /**
   * Orders needing attention in this view, *ignoring the flag filter*.
   *
   * A different scope from every other figure here, on purpose. The number
   * sits on a chip that is also the "needs attention" filter, and a count that
   * changes the moment you use it as a filter is a count nobody can trust —
   * filter to refunds and a view-scoped one would read "nothing needs
   * attention", which claims far more than the data does.
   */
  attention: number;
  currency: string | null;
  order_value: number;
  merchandise_value: number;
  mixed_currencies: boolean;
  by_currency: { currency: string | null; orders: number; order_value: number }[];
};

export type OrdersPage = Paged<ChannelOrder> & {
  totals: OrderTotals;
  /** The thresholds this page was flagged with, so the tab can say so. */
  rules: OrderFlagRules;
};

/** One order and every line on it — what the detail panel reads. */
export type ChannelOrderDetail = ChannelOrder & {
  lines: ChannelOrderItem[];
  /** What the channel calls its admin: "Shopify admin", "Seller Central". */
  destination?: string;
};

/** Per-channel counts for the Inventory header. `sum()` can come back null. */
export type InventorySummaryRow = {
  channel: ChannelId;
  products: number;
  units: number | null;
};

/** Per-channel totals for the Orders header, over the selected window. */
export type OrdersSummaryRow = {
  channel: ChannelId;
  orders: number;
  units: number | null;
  revenue: number | null;
};

/**
 * Ask Alaiy, as alaiy_os core presents it.
 *
 * The shapes are core's `api/chat.py` — `create_session`, `list_sessions` and
 * `_present()` respectively. Kept here rather than inferred so a change in core
 * shows up as a type error rather than as an undefined at runtime.
 */

export type ChatSession = {
  session: string;
  title: string | null;
  model: string;
  status: ChatStatus;
};

export type ChatStatus = "Idle" | "Running" | "Error";

export type ChatSessionSummary = {
  name: string;
  title: string | null;
  model: string;
  status: ChatStatus;
  last_activity: string | null;
  modified: string;
};

/** One tool the assistant ran. Results are deliberately not sent by core. */
export type ChatToolCall = {
  id: string | null;
  name: string | null;
  input: unknown;
};

export type ChatMessage = {
  name: string;
  seq: number;
  role: "user" | "assistant";
  text: string;
  attachments: unknown[];
  mentions: unknown[];
  skill: string | null;
  tool_calls: ChatToolCall[];
  /** ids of tool calls that failed, so the UI can say a step broke. */
  tool_errors: (string | null)[];
  /**
   * The assistant is still writing this one. `text` is what has arrived so
   * far, and the row is re-sent longer on every poll — so a cursor must not
   * advance past it. See getChatMessages.
   */
  partial: boolean;
  creation: string;
};

export type ChatFeed = {
  session: string;
  title: string | null;
  status: ChatStatus;
  error: string | null;
  messages: ChatMessage[];
  /**
   * Follow-up chips for the newest answer. Rides the feed rather than the
   * message because core writes them after the message is committed, by which
   * time a poller's cursor is already past it.
   */
  suggestions: string[];
};
