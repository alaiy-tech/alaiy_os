export const SALES_ORDER_DOCTYPE = "Sales Order";

// Always fetched regardless of columnOrder - needed for row identity and the
// Status quick-filter.
export const BASE_FIELDS = ["name", "customer_name", "status"];

// Sentinel value for the Status quick-filter's "All" option - not a real
// Sales Order status, so it's kept out of STATUS_BADGE_CLASS entirely.
export const ALL_STATUSES = "__all__";

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
export const DEFAULT_COLUMN_ORDER = ["customer_name", "status", "grand_total", "transaction_date"];

// Columns the user can never remove from columnOrder, on top of the ID
// column above (which isn't part of columnOrder at all).
export const COMPULSORY_COLUMNS = ["status", "grand_total"];

export const MIN_VISIBLE_COLUMNS = 4;

// Every status the doctype's Select field can hold - not every site's data
// will have used all of them, but this covers actual values with color once
// they show up. Anything else (a custom status) falls back to a neutral tone.
export const STATUS_BADGE_CLASS: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  "On Hold": "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "To Pay": "bg-orange-500/10 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  "To Deliver and Bill": "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "To Deliver": "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "To Bill": "bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Completed: "bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  Cancelled: "bg-destructive/10 text-destructive",
  Closed: "bg-muted text-muted-foreground",
};

export const DEFAULT_STATUS_BADGE_CLASS = "bg-muted text-muted-foreground";
