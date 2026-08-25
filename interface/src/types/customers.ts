import type { PeriodComparison } from "@/types/list";

/** As returned by alaiy_os.api.customer_stats.get_customers_overview - each
 * figure a {current, previous} pair over two equally-long windows. */
export type CustomersOverview = {
  period: string;
  total_customers: PeriodComparison;
  new_customers: PeriodComparison;
  active_customers: PeriodComparison;
  revenue_per_customer: PeriodComparison;
};

/** One month of the acquisition chart. `period` arrives pre-labelled "Aug 25"
 * from the backend, which is what the axis and tooltip parse. */
export type CustomerTrendPoint = {
  period: string;
  new_customers: number;
  active_customers: number;
};

/** A Customer plus its Sales Order aggregates, as returned by
 * alaiy_os.api.customer.get_customers. Nullable across the optional Link and
 * Read Only fields — Frappe returns "" or null for anything unset, and a
 * customer with no contact details or no orders is an ordinary record, not a
 * broken one. */
export type Customer = {
  name: string;
  customer_name: string;
  customer_group: string | null;
  territory: string | null;
  customer_type: string | null;
  email_id: string | null;
  mobile_no: string | null;
  image: string | null;
  /** The customer's billing currency; null falls back to the org default. */
  currency: string | null;
  disabled: 0 | 1;
  creation: string;
  orders: number;
  total_spend: number;
  last_order_date: string | null;
};

/** Derived from `disabled` plus whether the customer has ever ordered - not a
 * Customer field. ERPNext has no customer lifecycle state, and inventing one
 * would be the dummy data this page just lost. */
export type CustomerStatus = "Disabled" | "Active" | "No Orders";

/** `lib/frappe/customer-list.server.ts`'s `getCustomersServer()` result -
 * as returned by alaiy_os.api.customer.get_customers. */
export type CustomerListResult = { customers: Customer[]; total: number };
