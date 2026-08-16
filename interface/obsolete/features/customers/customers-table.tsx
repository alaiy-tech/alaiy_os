"use client";

import { OsDataTable, type OsDataTableProps } from "@/components/data-table/data-table";

import { type CustomerRow, customersColumns, customersFilterFields } from "./customers-columns";

type CustomersTableProps = Omit<OsDataTableProps<CustomerRow>, "columns" | "filterFields">;

/** Customers' `os-data-table` implementation - same reasoning as
 * `features/dashboard/recent-orders-table.tsx`: column defs are code
 * (imported directly here), not data (never threaded through
 * `data`/`DataSourceRef`). */
export function CustomersTable(props: CustomersTableProps) {
  return <OsDataTable columns={customersColumns} filterFields={customersFilterFields} {...props} />;
}
