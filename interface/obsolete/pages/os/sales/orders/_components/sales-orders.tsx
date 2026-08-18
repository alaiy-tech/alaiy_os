"use client";
"use no memo";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnSizingState,
  getCoreRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Cog, Download, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  type DateRange,
  DateRangePicker,
} from "@/components/date-range-picker";
import {
  type ColumnPrefs,
  type FilterRow,
  toFrappeFilters,
} from "@/components/list/types";
import { SelectionActionsMenu } from "@/components/menu/selection-actions-menu";
import type { ColumnField } from "@/components/popover/column-settings-popover";
import { ColumnSettingsPopover } from "@/components/popover/column-settings-popover";
import { FilterPopover } from "@/components/popover/filter-popover";
import { Button } from "@/components/primitive/button";
import { ButtonGroup } from "@/components/primitive/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/primitive/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/primitive/input-group";
import { Kbd } from "@/components/primitive/kbd";
import { Tabs, TabsList, TabsTrigger } from "@/components/primitive/tabs";
import {
  ALL_STATUSES,
  BASE_FIELDS,
  COMPULSORY_COLUMNS,
  DEFAULT_COLUMN_ORDER,
  EMPTY_STATE_BY_TAB,
  ID_COLUMN_FIELDNAME,
  MIN_VISIBLE_COLUMNS,
  SALES_ORDER_BASE_PATH,
  SALES_ORDER_DOCTYPE,
  STATUS_TAB_LABEL,
  STATUS_TABS,
  salesOrderHref,
} from "@/constants/sales-orders";
import { useDoctypeMeta } from "@/hooks/use-doctype-meta";
import { useListPreference } from "@/hooks/use-list-preference";
import {
  fetchSalesOrderCount,
  fetchSalesOrders,
} from "@/lib/frappe/sales-order-list";
import { getSalesOrdersSummary } from "@/lib/frappe/sales-order-stats";
import { toDateParam } from "@/lib/sales-orders";
import { useCompany } from "@/stores/company/company-provider";
import type { SalesOrderRow, SalesOrdersSummary } from "@/types/sales-orders";

import { CustomerFilter } from "./customer-filter";
import { buildSalesOrderColumns } from "./sales-order-columns";
import { SalesOrderKpiCards } from "./sales-order-kpi-cards";
import { SalesOrderTable } from "./sales-order-table";

export function SalesOrders() {
  const router = useRouter();
  const { meta } = useDoctypeMeta(SALES_ORDER_DOCTYPE);
  const { defaultCurrency } = useCompany();

  // Key bumped to :v2 deliberately. Column order is stored per user on the
  // server, so anyone who had opened the old page would keep a saved order
  // that predates the Delivery Date column and never see it - the new default
  // has to win once.
  const { value: columnPrefs, update: setColumnPrefs } =
    useListPreference<ColumnPrefs>("sales-orders:columns:v2", {
      columnOrder: DEFAULT_COLUMN_ORDER,
    });
  const { value: filterRows, update: setFilterRows } = useListPreference<
    FilterRow[]
  >("sales-orders:filters", []);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<string>(ALL_STATUSES);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [customer, setCustomer] = useState<string | undefined>();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "transaction_date", desc: true },
  ]);
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

  const [summary, setSummary] = useState<SalesOrdersSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryFailed, setSummaryFailed] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fieldsByName = useMemo(
    () => new Map((meta?.fields ?? []).map((f) => [f.fieldname, f])),
    [meta],
  );

  const columnFields: ColumnField[] = useMemo(
    () =>
      [...fieldsByName.values()]
        .filter((f) => f.fieldname !== ID_COLUMN_FIELDNAME)
        .map((f) => ({ fieldname: f.fieldname, label: f.label })),
    [fieldsByName],
  );

  // One filter set feeds both the table and the KPI strip, so the figures
  // above the table always describe the rows inside it.
  const { filters, orFilters, fromDate, toDate } = useMemo(() => {
    const built = toFrappeFilters(filterRows);
    if (statusTab !== ALL_STATUSES) built.push(["status", "=", statusTab]);
    if (customer) built.push(["customer", "=", customer]);

    const from = dateRange?.from ? toDateParam(dateRange.from) : undefined;
    const to = dateRange?.to ? toDateParam(dateRange.to) : undefined;
    if (from) built.push(["transaction_date", ">=", from]);
    if (to) built.push(["transaction_date", "<=", to]);

    return {
      filters: built,
      orFilters: search
        ? ([
            ["customer_name", "like", `%${search}%`],
            ["name", "like", `%${search}%`],
          ] as Array<[string, string, unknown]>)
        : undefined,
      fromDate: from,
      toDate: to,
    };
  }, [filterRows, statusTab, customer, dateRange, search]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const fields = Array.from(
      new Set([...BASE_FIELDS, ...columnPrefs.columnOrder]),
    );
    const sort = sorting[0];
    const orderBy = sort
      ? `${sort.id} ${sort.desc ? "desc" : "asc"}`
      : undefined;

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
  }, [
    filters,
    orFilters,
    columnPrefs.columnOrder,
    sorting,
    pagination.pageIndex,
    pagination.pageSize,
  ]);

  useEffect(() => {
    let cancelled = false;
    setIsSummaryLoading(true);

    getSalesOrdersSummary({ filters, orFilters, fromDate, toDate })
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setSummaryFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSummary(null);
        setSummaryFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters, orFilters, fromDate, toDate]);

  const columns = useMemo(
    () =>
      buildSalesOrderColumns({
        columnOrder: columnPrefs.columnOrder,
        fieldsByName,
        currency: defaultCurrency,
        detailHref: salesOrderHref,
      }),
    [columnPrefs.columnOrder, fieldsByName, defaultCurrency],
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

  /** Any filter change invalidates the current page number — page 4 of the
   * old result set is rarely page 4 of the new one. */
  function resetPage() {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  return (
    <div className="flex flex-col gap-4">
      <SalesOrderKpiCards
        summary={summary}
        isLoading={isSummaryLoading}
        hasFailed={summaryFailed}
      />

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
                resetPage();
              }}
            />
            <InputGroupAddon align="inline-end">
              <Kbd className="h-4 text-[10px]">⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>

          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <div className="flex items-center justify-between gap-3">
              {selectedIds.length > 0 && (
                <SelectionActionsMenu
                  selectedIds={selectedIds}
                  entityLabel="order"
                />
              )}
            </div>

            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                setDateRange(range);
                resetPage();
              }}
            />

            <CustomerFilter
              value={customer}
              onChange={(next) => {
                setCustomer(next);
                resetPage();
              }}
            />

            <ButtonGroup>
              <FilterPopover
                availableFields={[...(meta?.fields ?? [])]}
                value={filterRows}
                onApply={(rowsApplied) => {
                  setFilterRows(rowsApplied);
                  resetPage();
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Export is coming soon.")}
            >
              <Download /> Export
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`${SALES_ORDER_BASE_PATH}/new`)}
            >
              <Plus /> New Order
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-0 px-0">
          <div className="overflow-x-auto border-b px-4 py-2">
            <Tabs
              value={statusTab}
              onValueChange={(value) => {
                setStatusTab(value);
                resetPage();
              }}
            >
              <TabsList>
                {STATUS_TABS.map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {STATUS_TAB_LABEL[tab] ?? tab}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <SalesOrderTable
            table={table}
            isLoading={isLoading}
            totalCount={totalCount}
            emptyMessage={EMPTY_STATE_BY_TAB[statusTab] ?? "No orders found."}
            onRowClick={(row) => router.push(salesOrderHref(row.name))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
