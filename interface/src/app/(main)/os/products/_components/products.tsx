"use client";
"use no memo";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnSizingState,
  getCoreRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Cog, Download, Grid, Plus, Rows3, Search, X } from "lucide-react";
import { toast } from "sonner";

import { PaginationFooter } from "@/components/layout/pagination-footer";
import { type ColumnPrefs, type FilterRow, toFrappeFilters } from "@/components/list/types";
import { SelectionActionsMenu } from "@/components/menu/selection-actions-menu";
import type { ColumnField } from "@/components/popover/column-settings-popover";
import { ColumnSettingsPopover } from "@/components/popover/column-settings-popover";
import { FilterPopover } from "@/components/popover/filter-popover";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BASE_FIELDS,
  COMPULSORY_COLUMNS,
  DEFAULT_COLUMN_ORDER,
  ID_COLUMN_FIELDNAME,
  IMAGE_COLUMN_FIELDNAME,
  ITEM_DOCTYPE,
  MIN_VISIBLE_COLUMNS,
  productHref,
  SYNTHETIC_COLUMN_FIELDS,
} from "@/constants/products";
import { useDoctypeMeta } from "@/hooks/use-doctype-meta";
import { useListPreference } from "@/hooks/use-list-preference";
import { fetchItemCount, fetchItems } from "@/lib/frappe/item-list";
import { useCompany } from "@/stores/company/company-provider";
import type { ProductRow } from "@/types/products";

import { buildProductColumns } from "./product-columns";
import { ProductGrid } from "./product-grid";
import { ProductTable } from "./product-table";

type ViewMode = "list" | "grid";

export default function Products() {
  const router = useRouter();
  const { meta } = useDoctypeMeta(ITEM_DOCTYPE);

  const { value: columnPrefs, update: setColumnPrefs } = useListPreference<ColumnPrefs>("products:columns", {
    columnOrder: DEFAULT_COLUMN_ORDER,
  });
  const { value: filterRows, update: setFilterRows } = useListPreference<FilterRow[]>("products:filters", []);

  const [view, setView] = useState<ViewMode>("list");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "item_name", desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const fieldsByName = useMemo(() => {
    const map = new Map((meta?.fields ?? []).map((f) => [f.fieldname, f]));
    for (const f of SYNTHETIC_COLUMN_FIELDS) map.set(f.fieldname, f);
    return map;
  }, [meta]);

  const columnFields: ColumnField[] = useMemo(
    () =>
      [...fieldsByName.values()]
        .filter((f) => f.fieldname !== IMAGE_COLUMN_FIELDNAME && f.fieldname !== ID_COLUMN_FIELDNAME)
        .map((f) => ({ fieldname: f.fieldname, label: f.label })),
    [fieldsByName],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const fields = Array.from(new Set([...BASE_FIELDS, ...columnPrefs.columnOrder.filter((f) => f !== "status")]));
    const filters = toFrappeFilters(filterRows);
    const orFilters: Array<[string, string, unknown]> | undefined = search
      ? [
          ["item_name", "like", `%${search}%`],
          ["item_code", "like", `%${search}%`],
        ]
      : undefined;
    const sort = sorting[0];
    const orderBy = sort && sort.id !== "status" ? `${sort.id} ${sort.desc ? "desc" : "asc"}` : undefined;

    Promise.all([
      fetchItems({
        fields,
        filters,
        orFilters,
        orderBy,
        limitStart: pagination.pageIndex * pagination.pageSize,
        limitPageLength: pagination.pageSize,
      }),
      fetchItemCount(filters, orFilters),
    ])
      .then(([data, count]) => {
        if (cancelled) return;
        setRows(data as ProductRow[]);
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
  }, [columnPrefs.columnOrder, filterRows, search, sorting, pagination.pageIndex, pagination.pageSize]);

  const toggleExpand = useCallback((row: ProductRow) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.name)) next.delete(row.name);
      else next.add(row.name);
      return next;
    });
  }, []);

  const { defaultCurrency } = useCompany();

  const columns = useMemo(
    () =>
      buildProductColumns({
        columnOrder: columnPrefs.columnOrder,
        fieldsByName,
        expandedIds,
        onToggleExpand: toggleExpand,
        currency: defaultCurrency,
        detailHref: productHref,
      }),
    [columnPrefs.columnOrder, fieldsByName, expandedIds, toggleExpand, defaultCurrency],
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
        <CardTitle className="text-xl leading-none">Products</CardTitle>
        <CardDescription className="max-w-sm leading-snug">Manage your product catalog.</CardDescription>
        <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              className="h-7"
              placeholder="Search Products..."
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
          <Button size="sm" onClick={() => toast.info("Add Product is coming soon.")}>
            <Plus /> Add Product
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          {selectedIds.length > 0 && <SelectionActionsMenu selectedIds={selectedIds} entityLabel="product" />}

          <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)} className="ml-auto">
            <TabsList>
              <TabsTrigger value="list" aria-label="List view">
                <Rows3 />
              </TabsTrigger>
              <TabsTrigger value="grid" aria-label="Grid view">
                <Grid />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {view === "list" ? (
          <ProductTable
            table={table}
            isLoading={isLoading}
            totalCount={totalCount}
            expandedIds={expandedIds}
            onRowClick={(row) => router.push(productHref(row.name))}
          />
        ) : (
          <>
            <ProductGrid rows={rows} isLoading={isLoading} />
            <Separator />
            <PaginationFooter table={table} totalCount={totalCount} itemLabel="products" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
