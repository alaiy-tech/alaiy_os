import type { PeriodComparison } from "@/types/list";

export type PurchaseOrderRow = Record<string, unknown> & {
  name: string;
  supplier_name?: string;
  status?: string;
};

export type PurchaseOrdersOverview = {
  period: string;
  total_orders: PeriodComparison;
  total_order_value: PeriodComparison;
  average_order_value: PeriodComparison;
  cancelled_orders: PeriodComparison;
};
