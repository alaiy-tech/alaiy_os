import { STATUS_TONE } from "@/constants/list";

export const PURCHASE_ORDER_DOCTYPE = "Purchase Order";

// Kept here rather than in the list component so the detail page (a Server
// Component) can reach them without importing a "use client" module for the
// sake of a string.
export const PURCHASE_ORDER_BASE_PATH = "/os/procurement/purchase-orders";

export function purchaseOrderHref(name: string): string {
  return `${PURCHASE_ORDER_BASE_PATH}/${encodeURIComponent(name)}`;
}

// Always fetched regardless of columnOrder - name for row identity and the
// detail link, status and schedule_date because the Expected Date cell needs
// both to decide whether it is overdue even when Status is hidden.
export const BASE_FIELDS = ["name", "supplier_name", "status", "schedule_date"];

// Sentinel value for the "All" tab - not a real Purchase Order status, so it
// is kept out of STATUS_BADGE_CLASS entirely.
export const ALL_STATUSES = "__all__";

// The tab strip, in the order the page shows it. Fixed rather than read from
// the site's existing orders (the old Status dropdown did the latter): a tab
// that vanishes because nothing currently sits in that state makes the filter
// row jump around, and "no orders to receive" is a useful answer in itself.
export const STATUS_TABS = [
  ALL_STATUSES,
  "Draft",
  "To Receive and Bill",
  "To Bill",
  "To Receive",
  "Completed",
  "Cancelled",
] as const;

export const STATUS_TAB_LABEL: Record<string, string> = {
  [ALL_STATUSES]: "All",
};

// What the table says when a tab has nothing in it.
export const EMPTY_STATE_BY_TAB: Record<string, string> = {
  [ALL_STATUSES]: "No purchase orders yet.",
  Draft: "No draft orders.",
  "To Receive and Bill": "No orders to receive and bill.",
  "To Bill": "No orders to bill.",
  "To Receive": "No orders to receive.",
  Completed: "No completed orders.",
  Cancelled: "No cancelled orders.",
};

// An order past its required-by date is only worth flagging while it can still
// be received. Mirrors SETTLED_STATUSES in
// alaiy_os/api/purchase_order_stats.py, which decides the same thing for the
// Past-due Receipts KPI - the cell highlight and that figure must agree on
// what "overdue" means.
export const SETTLED_STATUSES = ["Completed", "Cancelled"];

// The ID (docname) column is always shown first and is neither reorderable
// nor removable - buildPurchaseOrderColumns renders it directly rather than
// sourcing it from columnOrder, so it's not part of the Columns popover at all.
export const ID_COLUMN_FIELDNAME = "name";

// transaction_date's real Frappe label is just "Date", and schedule_date's is
// "Required By" - both overridden to the wording the issue's column table
// uses, which also reads unambiguously next to each other.
export const LABEL_OVERRIDES: Record<string, string> = {
  transaction_date: "Order Date",
  schedule_date: "Expected Date",
};

// Columns shown the first time the Purchase Orders table is ever opened
// (before any user customization is saved). per_received and currency are
// left out of the default - still pickable from the Columns popover, just not
// shown until a user opts in.
export const DEFAULT_COLUMN_ORDER = ["supplier_name", "status", "transaction_date", "schedule_date", "grand_total"];

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
  "To Receive and Bill": STATUS_TONE.info,
  "To Receive": STATUS_TONE.info,
  "To Bill": STATUS_TONE.info,
  Delivered: STATUS_TONE.success,
  Completed: STATUS_TONE.success,
  Cancelled: STATUS_TONE.destructive,
  Closed: STATUS_TONE.neutral,
};

export const DEFAULT_STATUS_BADGE_CLASS = STATUS_TONE.neutral;

// Purchase Receipt / Purchase Invoice statuses, for the linked-document
// tables on the detail page. Both doctypes share a vocabulary with the
// accounting side of the app (Unpaid, Overdue, Return, ...), so their colours
// are kept separate from the order's own.
export const LINKED_DOC_BADGE_CLASS: Record<string, string> = {
  Draft: STATUS_TONE.neutral,
  Completed: STATUS_TONE.success,
  Paid: STATUS_TONE.success,
  "To Bill": STATUS_TONE.info,
  Unpaid: STATUS_TONE.warning,
  Overdue: STATUS_TONE.destructive,
  Cancelled: STATUS_TONE.destructive,
  Return: STATUS_TONE.caution,
  "Debit Note Issued": STATUS_TONE.caution,
  Closed: STATUS_TONE.neutral,
};
