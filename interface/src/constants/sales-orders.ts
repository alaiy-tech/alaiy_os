import { STATUS_TONE } from "@/constants/list";

export const SALES_ORDER_DOCTYPE = "Sales Order";

export const SALES_ORDER_BASE_PATH = "/os/sales/orders";

export function salesOrderHref(name: string): string {
  return `${SALES_ORDER_BASE_PATH}/${encodeURIComponent(name)}`;
}

// Always fetched regardless of columnOrder - name for row identity and the
// detail link, status and delivery_date because the Delivery Date cell needs
// both to decide whether it is overdue even when Status is hidden.
export const BASE_FIELDS = ["name", "customer_name", "status", "delivery_date"];

// Sentinel value for the "All" tab - not a real Sales Order status, so it is
// kept out of STATUS_BADGE_CLASS entirely.
export const ALL_STATUSES = "__all__";

// The tab strip, in the order the page shows it. Fixed rather than read from
// the site's existing orders (the old Status dropdown did the latter): a tab
// that vanishes because nothing currently sits in that state makes the filter
// row jump around, and "no orders to bill" is a useful answer in itself.
export const STATUS_TABS = [
  ALL_STATUSES,
  "Draft",
  "To Deliver and Bill",
  "To Bill",
  "To Deliver",
  "Completed",
  "Cancelled",
] as const;

export const STATUS_TAB_LABEL: Record<string, string> = {
  [ALL_STATUSES]: "All",
};

// What the table says when a tab has nothing in it.
export const EMPTY_STATE_BY_TAB: Record<string, string> = {
  [ALL_STATUSES]: "No sales orders yet.",
  Draft: "No draft orders.",
  "To Deliver and Bill": "No orders to deliver and bill.",
  "To Bill": "No orders to bill.",
  "To Deliver": "No orders to deliver.",
  Completed: "No completed orders.",
  Cancelled: "No cancelled orders.",
};

// An order past its delivery date is only worth flagging while it can still
// be delivered. Mirrors SETTLED_STATUSES in alaiy_os/api/sales_order_stats.py,
// which decides the same thing for the Past-due Deliveries KPI - the cell
// highlight and that figure must agree on what "overdue" means.
export const SETTLED_STATUSES = ["Completed", "Cancelled"];

// The ID (docname) column is always shown first and is neither reorderable
// nor removable - buildSalesOrderColumns renders it directly rather than
// sourcing it from columnOrder, so it's not part of the Columns popover at all.
export const ID_COLUMN_FIELDNAME = "name";

// transaction_date's real Frappe label is just "Date" - overridden here since
// "Order Date" is unambiguous next to Sales Order's other date-ish columns.
export const LABEL_OVERRIDES: Record<string, string> = {
  transaction_date: "Order Date",
};

// Columns shown the first time the Sales Orders table is ever opened (before
// any user customization is saved). sales_channel, customer_group, and
// currency are left out of the default - still pickable from the Columns
// popover, just not shown until a user opts in.
export const DEFAULT_COLUMN_ORDER = ["customer_name", "status", "transaction_date", "delivery_date", "grand_total"];

// Columns the user can never remove from columnOrder, on top of the ID
// column above (which isn't part of columnOrder at all).
export const COMPULSORY_COLUMNS = ["status", "grand_total"];

export const MIN_VISIBLE_COLUMNS = 4;

// Every status the doctype's Select field can hold - not every site's data
// will have used all of them, but this covers actual values with color once
// they show up. Anything else (a custom status) falls back to a neutral tone.
export const STATUS_BADGE_CLASS: Record<string, string> = {
  Draft: STATUS_TONE.neutral,
  "On Hold": STATUS_TONE.warning,
  "To Pay": STATUS_TONE.caution,
  "To Deliver and Bill": STATUS_TONE.info,
  "To Deliver": STATUS_TONE.info,
  "To Bill": STATUS_TONE.info,
  Completed: STATUS_TONE.success,
  Cancelled: STATUS_TONE.destructive,
  Closed: STATUS_TONE.neutral,
};

export const DEFAULT_STATUS_BADGE_CLASS = STATUS_TONE.neutral;

// Status colours for the Delivery Notes and Sales Invoices raised against an
// order. Kept apart from STATUS_BADGE_CLASS above because the same word means
// different things across the two: a Sales Order "To Bill" is mid-flight,
// while an invoice's "Unpaid" is the one that wants attention.
export const LINKED_DOC_BADGE_CLASS: Record<string, string> = {
  Draft: STATUS_TONE.neutral,
  Completed: STATUS_TONE.success,
  Paid: STATUS_TONE.success,
  "To Bill": STATUS_TONE.info,
  Unpaid: STATUS_TONE.warning,
  Overdue: STATUS_TONE.destructive,
  Cancelled: STATUS_TONE.destructive,
  Return: STATUS_TONE.caution,
  "Credit Note Issued": STATUS_TONE.caution,
};

// The lifecycle strip on the detail page. Deliberately five fixed steps rather
// than the doctype's own status list: Sales Order statuses are not a sequence
// (an order sits in "To Deliver and Bill" while it is partway through both
// steps at once), and a progress bar has to be able to say where the order is.
export const PROGRESS_STEPS = ["Draft", "Confirmed", "To Deliver", "To Bill", "Completed"] as const;

export type ProgressStep = (typeof PROGRESS_STEPS)[number];
