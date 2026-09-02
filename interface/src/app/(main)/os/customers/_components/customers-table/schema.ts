import { STATUS_TONE } from "@/constants/list";
import { formatCurrency } from "@/lib/utils";
import type { Customer, CustomerStatus } from "@/types/customers";

/** The table's row shape. Money is formatted here rather than server-side so
 * each customer keeps its own billing currency, falling back to the org
 * default - the same split recent-orders makes. */
export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  status: CustomerStatus;
  group: string | null;
  territory: string | null;
  orders: number;
  /** The formatted figure the cell shows. */
  spend: string;
  /** The same figure unformatted, so the column sorts numerically rather
   * than lexically — "$9" must not sort above "$10". */
  spendValue: number;
  /** ISO date, or null for a customer who has never ordered. */
  lastOrder: string | null;
  /** Frappe's "YYYY-MM-DD HH:MM:SS.ffffff", normalised to ISO. */
  joined: string;
};

export const customerStatuses: CustomerStatus[] = ["Active", "No Orders", "Disabled"];

export const CUSTOMER_STATUS_TONE: Record<CustomerStatus, string> = {
  Active: STATUS_TONE.success,
  "No Orders": STATUS_TONE.neutral,
  Disabled: STATUS_TONE.destructive,
};

/** ERPNext has no customer lifecycle field, so status is derived: disabled
 * wins, then whether they have ever placed a submitted order. */
export function toCustomerStatus(customer: Customer): CustomerStatus {
  if (customer.disabled) return "Disabled";
  return customer.orders > 0 ? "Active" : "No Orders";
}

/** Frappe returns "" for an unset Data or Link field, which the table has to
 * read as absent. Spelled out rather than `?? null`, which keeps the empty
 * string, or `|| null`, which the linter rejects for catching every falsy
 * value — here that breadth is the point, but only for two known values. */
function blankToNull(value: string | null): string | null {
  return value === null || value === "" ? null : value;
}

export function toCustomerRow(customer: Customer, defaultCurrency?: string): CustomerRow {
  return {
    id: customer.name,
    name: customer.customer_name,
    email: blankToNull(customer.email_id),
    image: blankToNull(customer.image),
    status: toCustomerStatus(customer),
    group: blankToNull(customer.customer_group),
    territory: blankToNull(customer.territory),
    orders: customer.orders,
    // blankToNull, not ?? alone: an unset Link comes back as "", which ??
    // keeps and Intl.NumberFormat then throws on as an invalid currency code.
    spend: formatCurrency(customer.total_spend, {
      currency: blankToNull(customer.currency) ?? defaultCurrency,
    }),
    spendValue: customer.total_spend,
    lastOrder: customer.last_order_date,
    joined: customer.creation.replace(" ", "T"),
  };
}
