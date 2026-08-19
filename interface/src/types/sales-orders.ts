export type SalesOrderRow = Record<string, unknown> & {
  name: string;
  customer?: string;
  customer_name?: string;
  status?: string;
  transaction_date?: string;
  delivery_date?: string;
  grand_total?: number;
};

/** `previous` is null when no date range is selected: there is no comparable
 * preceding window, so the KPI card drops its trend badge rather than
 * comparing against an invented baseline. */
export type SummaryComparison = { current: number; previous: number | null };

export type SalesOrdersSummary = {
  total_orders: SummaryComparison;
  total_gmv: SummaryComparison;
  average_order_value: SummaryComparison;
  past_due_deliveries: SummaryComparison;
};

export type DateRange = { from?: Date; to?: Date };

export type SalesOrderHeader = {
  name: string;
  customer: string;
  customer_name: string | null;
  company: string | null;
  status: string;
  docstatus: number;
  transaction_date: string | null;
  delivery_date: string | null;
  po_no: string | null;
  currency: string | null;
  conversion_rate: number | null;
  per_delivered: number | null;
  per_billed: number | null;
  amended_from: string | null;
  /** Custom field this app adds to Sales Order (see setup/install.py) — absent
   * on a site the app has not migrated yet, hence optional. */
  sales_channel?: string | null;
};

export type SalesOrderLine = {
  name: string;
  idx: number;
  item_code: string;
  item_name: string | null;
  description: string | null;
  uom: string | null;
  qty: number;
  delivered_qty: number;
  /** Summed from the linked Sales Invoice lines — Sales Order Item itself
   * carries only `billed_amt`, a currency. */
  billed_qty: number;
  rate: number;
  amount: number;
  delivery_date: string | null;
  warehouse: string | null;
};

export type SalesOrderTax = {
  idx: number;
  charge_type: string | null;
  account_head: string | null;
  description: string | null;
  rate: number | null;
  tax_amount: number;
  total: number;
};

export type SalesOrderTotals = {
  total_qty: number | null;
  total: number | null;
  total_taxes_and_charges: number | null;
  discount_amount: number | null;
  apply_discount_on: string | null;
  grand_total: number | null;
  rounded_total: number | null;
  disable_rounded_total: number | null;
};

export type SalesOrderPaymentTerm = {
  idx: number;
  payment_term: string | null;
  description: string | null;
  due_date: string | null;
  invoice_portion: number | null;
  payment_amount: number | null;
  paid_amount: number | null;
  outstanding: number | null;
};

export type LinkedDeliveryNote = {
  name: string;
  posting_date: string | null;
  status: string | null;
  docstatus: number;
  is_return: number;
  grand_total: number | null;
  currency: string | null;
};

export type LinkedSalesInvoice = {
  name: string;
  posting_date: string | null;
  due_date: string | null;
  status: string | null;
  docstatus: number;
  is_return: number;
  grand_total: number | null;
  outstanding_amount: number | null;
  currency: string | null;
};

export type SalesOrderDetail = {
  order: SalesOrderHeader;
  items: SalesOrderLine[];
  taxes: SalesOrderTax[];
  totals: SalesOrderTotals;
  payment_schedule: SalesOrderPaymentTerm[];
  delivery_notes: LinkedDeliveryNote[];
  invoices: LinkedSalesInvoice[];
};
