import type { PeriodComparison } from "@/types/list";

export type SalesOrderRow = Record<string, unknown> & {
  name: string;
  customer_name?: string;
  status?: string;
};

export type SalesOrdersOverview = {
  period: string;
  total_orders: PeriodComparison;
  total_order_value: PeriodComparison;
  average_order_value: PeriodComparison;
  cancelled_orders: PeriodComparison;
};
