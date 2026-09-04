export type PurchaseOrderRow = Record<string, unknown> & {
  name: string;
  supplier?: string;
  supplier_name?: string;
  status?: string;
  transaction_date?: string;
  schedule_date?: string;
  grand_total?: number;
};

/** `previous` is null when no date range is selected: there is no comparable
 * preceding window, so the KPI card drops its trend badge rather than
 * comparing against an invented baseline. */
export type SummaryComparison = { current: number; previous: number | null };

export type PurchaseOrdersSummary = {
  total_orders: SummaryComparison;
  total_spend: SummaryComparison;
  average_order_value: SummaryComparison;
  past_due_receipts: SummaryComparison;
};

export type PurchaseOrderHeader = {
  name: string;
  supplier: string;
  supplier_name: string | null;
  company: string | null;
  status: string;
  docstatus: number;
  transaction_date: string | null;
  schedule_date: string | null;
  currency: string | null;
  conversion_rate: number | null;
  per_received: number | null;
  per_billed: number | null;
};

export type PurchaseOrderLine = {
  name: string;
  idx: number;
  item_code: string;
  item_name: string | null;
  uom: string | null;
  qty: number;
  received_qty: number;
  /** Summed from the linked Purchase Invoice lines — Purchase Order Item
   * itself carries only `billed_amt`, a currency. */
  billed_qty: number;
  rate: number;
  amount: number;
  schedule_date: string | null;
  warehouse: string | null;
};

export type PurchaseOrderTax = {
  idx: number;
  charge_type: string | null;
  account_head: string | null;
  description: string | null;
  rate: number | null;
  tax_amount: number;
  total: number;
};

export type PurchaseOrderTotals = {
  total_qty: number | null;
  total: number | null;
  total_taxes_and_charges: number | null;
  discount_amount: number | null;
  apply_discount_on: string | null;
  grand_total: number | null;
  rounded_total: number | null;
  disable_rounded_total: number | null;
};

export type LinkedPurchaseReceipt = {
  name: string;
  posting_date: string | null;
  status: string | null;
  docstatus: number;
  is_return: number;
  grand_total: number | null;
  currency: string | null;
};

export type LinkedPurchaseInvoice = {
  name: string;
  posting_date: string | null;
  due_date: string | null;
  bill_no: string | null;
  status: string | null;
  docstatus: number;
  is_return: number;
  grand_total: number | null;
  outstanding_amount: number | null;
  currency: string | null;
};

export type PurchaseOrderDetail = {
  order: PurchaseOrderHeader;
  items: PurchaseOrderLine[];
  taxes: PurchaseOrderTax[];
  totals: PurchaseOrderTotals;
  receipts: LinkedPurchaseReceipt[];
  invoices: LinkedPurchaseInvoice[];
};
