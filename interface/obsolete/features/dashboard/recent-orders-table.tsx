"use client";

import { OsDataTable, type OsDataTableProps } from "@/components/data-table/data-table";

import { type RecentOrderRow, recentOrdersColumns, recentOrdersFilterFields } from "./recent-orders-columns";

type RecentOrdersTableProps = Omit<OsDataTableProps<RecentOrderRow>, "columns" | "filterFields">;

/**
 * The dashboard's `os-data-table` implementation. TanStack column defs carry
 * render *functions* (`cell`, `header`) - values that can never cross a
 * Server -> Client Component prop boundary, unlike a pre-rendered React
 * element (which Next.js's RSC serialization resolves recursively). Threading
 * `recentOrdersColumns` through the generic `data`/`DataSourceRef` mechanism
 * (as Round 2 did) crashed with exactly that error the first time this page
 * was loaded through a real Server Component. The fix: column definitions
 * are code, and code stays a normal static import, not "data" - only the
 * genuinely serializable rows flow through `data`. This wrapper is the
 * feature-owned adapter around the shared, reusable `OsDataTable`.
 */
export function RecentOrdersTable(props: RecentOrdersTableProps) {
  return <OsDataTable columns={recentOrdersColumns} filterFields={recentOrdersFilterFields} {...props} />;
}
