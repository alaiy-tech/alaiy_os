import { SETTLED_STATUSES } from "@/constants/sales-orders";
import { isPastDue } from "@/lib/dates";

export { toDateParam, todayIso } from "@/lib/dates";

/** Whether an order's delivery date has passed while it can still be
 * delivered. The settled-status rule mirrors SETTLED_STATUSES in
 * alaiy_os/api/sales_order_stats.py; the highlighted cells are meant to be
 * exactly the orders the Past-due Deliveries KPI counts. */
export function isDeliveryPastDue(deliveryDate: unknown, status: unknown): boolean {
  return isPastDue(deliveryDate, status, SETTLED_STATUSES);
}
