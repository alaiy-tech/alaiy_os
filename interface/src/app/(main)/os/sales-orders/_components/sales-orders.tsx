"use client";
"use no memo";

import { useEffect, useMemo, useState } from "react";

import {
  type ColumnSizingState,
  getCoreRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Cog, Download, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { type ColumnPrefs, type FilterRow, toFrappeFilters } from "@/components/list/types";
import { SelectionActionsMenu } from "@/components/menu/selection-actions-menu";
import type { ColumnField } from "@/components/popover/column-settings-popover";
import { ColumnSettingsPopover } from "@/components/popover/column-settings-popover";
import { FilterPopover } from "@/components/popover/filter-popover";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ALL_STATUSES,
  BASE_FIELDS,
  COMPULSORY_COLUMNS,
  DEFAULT_COLUMN_ORDER,
  MIN_VISIBLE_COLUMNS,
  SALES_ORDER_DOCTYPE,
} from "@/constants/sales-orders";
import { useDoctypeMeta } from "@/hooks/use-doctype-meta";
import { useListPreference } from "@/hooks/use-list-preference";
import { fetchSalesOrderCount, fetchSalesOrders } from "@/lib/frappe/sales-order-list";
import { getOrderStatuses } from "@/lib/frappe/sales-order-stats";
import type { SalesOrderRow } from "@/types/sales-orders";

import { buildSalesOrderColumns } from "./sales-order-columns";
import { SalesOrderTable } from "./sales-order-table";

export function SalesOrders() {
  const { meta } = useDoctypeMeta(SALES_ORDER_DOCTYPE);

  const { value: columnPrefs, update: setColumnPrefs } = useListPreference<ColumnPrefs>("sales-orders:columns", {
    columnOrder: DEFAULT_COLUMN_ORDER,
  });
  const { value: filterRows, update: setFilterRows } = useListPreference<FilterRow[]>("sales-orders:filters", []);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "transaction_date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [rows, setRows] = useState<SalesOrderRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getOrderStatuses()
      .then(setStatusOptions)
      .catch(() => setStatusOptions([]));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fieldsByName = useMemo(() => new Map((meta?.fields ?? []).map((f) => [f.fieldname, f])), [meta]);

  const columnFields: ColumnField[] = useMemo(
    () =>
      [...fieldsByName.values()].map((f) => ({
        fieldname: f.fieldname,
        label: f.label,
      })),
    [fieldsByName],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const fields = Array.from(new Set([...BASE_FIELDS, ...columnPrefs.columnOrder]));
    const filters = toFrappeFilters(filterRows);
    if (statusFilter !== ALL_STATUSES) filters.push(["status", "=", statusFilter]);
    const orFilters: Array<[string, string, unknown]> | undefined = search
      ? [
          ["customer_name", "like", `%${search}%`],
          ["name", "like", `%${search}%`],
        ]
      : undefined;
    const sort = sorting[0];
    const orderBy = sort ? `${sort.id} ${sort.desc ? "desc" : "asc"}` : undefined;

    Promise.all([
      fetchSalesOrders({
        fields,
        filters,
        orFilters,
        orderBy,
        limitStart: pagination.pageIndex * pagination.pageSize,
        limitPageLength: pagination.pageSize,
      }),
      fetchSalesOrderCount(filters, orFilters),
    ])
      .then(([data, count]) => {
        if (cancelled) return;
        setRows(data as SalesOrderRow[]);
        setTotalCount(count);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [columnPrefs.columnOrder, filterRows, search, statusFilter, sorting, pagination.pageIndex, pagination.pageSize]);

  const columns = useMemo(
    () =>
      buildSalesOrderColumns({
        columnOrder: columnPrefs.columnOrder,
        fieldsByName,
      }),
    [columnPrefs.columnOrder, fieldsByName],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination, rowSelection, columnSizing },
    getRowId: (row) => row.name,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    pageCount: Math.max(Math.ceil(totalCount / pagination.pageSize), 1),
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedIds = Object.keys(rowSelection);

  return (
    <Card className="gap-0">
      <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <InputGroup className="h-7 w-full md:w-64">
          <InputGroupAddon align="inline-start">
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            className="h-7"
            placeholder="Search Orders..."
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          />
          <InputGroupAddon align="inline-end">
            <Kbd className="h-4 text-[10px]">⌘K</Kbd>
          </InputGroupAddon>
        </InputGroup>

        <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
          <div className="flex items-center justify-between gap-3">
            {selectedIds.length > 0 && <SelectionActionsMenu selectedIds={selectedIds} entityLabel="order" />}
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">Status:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                <SelectItem value={ALL_STATUSES}>All</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <ButtonGroup>
            <FilterPopover
              availableFields={[...(meta?.fields ?? [])]}
              value={filterRows}
              onApply={(rowsApplied) => {
                setFilterRows(rowsApplied);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={filterRows.length === 0}
              onClick={() => setFilterRows([])}
              aria-label="Clear all filters"
            >
              <X />
            </Button>
          </ButtonGroup>

          <ColumnSettingsPopover
            open={columnsOpen}
            onOpenChange={setColumnsOpen}
            trigger={
              <Button variant="outline" size="sm">
                <Cog /> Columns
              </Button>
            }
            availableFields={columnFields}
            value={columnPrefs}
            minVisibleColumns={MIN_VISIBLE_COLUMNS}
            compulsoryFields={COMPULSORY_COLUMNS}
            onSave={(prefs) => {
              if (prefs.columnOrder.length < MIN_VISIBLE_COLUMNS) return;
              setColumnPrefs(prefs);
            }}
          />

          <Button variant="outline" size="sm" onClick={() => toast.info("Export is coming soon.")}>
            <Download /> Export
          </Button>
          <Button size="sm" onClick={() => toast.info("Add Order is coming soon.")}>
            <Plus /> Add Order
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col px-0 gap-0">
        <SalesOrderTable table={table} isLoading={isLoading} totalCount={totalCount} />
      </CardContent>
    </Card>
  );
}
