import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeGetDocCount, useFrappeGetDocList, type Filter } from "frappe-react-sdk";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, EllipsisVertical, FileText, Plus, Search } from "lucide-react";

import { useDoctypeList } from "@/hooks/use-doctype-list";
import { useDataTable } from "@/hooks/use-data-table";
import { useStatusCounts } from "@/hooks/use-status-counts";
import { DataTable } from "@/components/data/data-table";
import { DataTablePagination } from "@/components/data/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusTone } from "@/lib/status";

interface SalesOrderRow {
  name: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string | null;
  grand_total: number;
  currency: string;
  per_delivered: number;
  per_billed: number;
  status: string;
}

const STATUS_TABS = ["All", "Draft", "To Deliver and Bill", "To Bill", "Completed", "On Hold", "Cancelled"];

export default function SalesOrderListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("All");
  const [territory, setTerritory] = useState("All");
  const [company, setCompany] = useState("All");

  const { data: territories } = useFrappeGetDocList<{ name: string }>("Territory", { fields: ["name"], limit: 100 });
  const { data: companies } = useFrappeGetDocList<{ name: string }>("Company", { fields: ["name"], limit: 50 });
  const { data: openCount } = useFrappeGetDocCount("Sales Order", [["status", "not in", ["Completed", "Cancelled", "Closed"]]]);

  const tabCounts = useStatusCounts("Sales Order", STATUS_TABS);

  const extraFilters = useMemo<Filter[]>(() => {
    const f: Filter[] = [];
    if (tab !== "All") f.push(["status", "=", tab]);
    if (territory !== "All") f.push(["territory", "=", territory]);
    if (company !== "All") f.push(["company", "=", company]);
    return f;
  }, [tab, territory, company]);

  const { data, isLoading, error, page, setPage, pageSize, hasNextPage, totalCount, search, setSearch } = useDoctypeList<SalesOrderRow>(
    "Sales Order",
    {
      fields: ["name", "customer", "customer_name", "transaction_date", "delivery_date", "grand_total", "currency", "per_delivered", "per_billed", "status"],
      searchField: "customer_name",
      orderBy: { field: "transaction_date", order: "desc" },
      filters: extraFilters,
    },
  );

  const columns = useMemo<ColumnDef<SalesOrderRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Order ID",
        cell: ({ getValue }) => <span className="font-medium tracking-[-.012em] text-navy tabular-nums">{getValue<string>()}</span>,
      },
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => <span className="max-w-[230px] truncate text-ink">{row.original.customer_name || row.original.customer}</span>,
      },
      { accessorKey: "transaction_date", header: "Date", cell: ({ getValue }) => (
        <span className="text-[12.5px] tabular-nums text-slate">{formatDate(getValue<string>())}</span>
      ) },
      { accessorKey: "delivery_date", header: "Deliver by", cell: ({ getValue }) => (
        <span className="text-[12.5px] tabular-nums text-slate">{formatDate(getValue<string | null>()) ?? "—"}</span>
      ) },
      {
        accessorKey: "grand_total",
        header: "Grand total",
        cell: ({ row }) => (
          <span className="font-semibold tracking-[-.016em] tabular-nums">{formatCurrency(row.original.grand_total, row.original.currency)}</span>
        ),
      },
      {
        accessorKey: "per_delivered",
        header: "Delivered",
        cell: ({ getValue }) => (
          <div className="flex items-center gap-2">
            <Progress value={getValue<number>()} className="h-[5px] w-[52px]" />
            <span className="text-[11.5px] tabular-nums text-slate">{getValue<number>()}%</span>
          </div>
        ),
      },
      {
        accessorKey: "per_billed",
        header: "Billed",
        cell: ({ getValue }) => (
          <div className="flex items-center gap-2">
            <Progress value={getValue<number>()} className="h-[5px] w-[52px]" indicatorClassName="bg-blue" />
            <span className="text-[11.5px] tabular-nums text-slate">{getValue<number>()}%</span>
          </div>
        ),
      },
      { accessorKey: "status", header: "Status", cell: ({ getValue }) => <Badge variant={statusTone(getValue<string>())}>{getValue<string>()}</Badge> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex size-7 items-center justify-center rounded-md text-ash transition-colors hover:bg-line-subtle hover:text-ink">
                  <EllipsisVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[184px]">
                <DropdownMenuItem onSelect={() => navigate(`/sales-orders/${encodeURIComponent(row.original.name)}`)}>Open order</DropdownMenuItem>
                <DropdownMenuItem disabled>Print / download PDF</DropdownMenuItem>
                <DropdownMenuItem disabled>Create Delivery Note</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-danger-fg">
                  Cancel order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [navigate],
  );

  const table = useDataTable({ columns, data, getRowId: (r) => r.name });

  return (
    <div className="max-w-[1520px] px-8 pt-7 pb-14">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-.025em] text-ink">Sales Order</h1>
          <p className="mt-[5px] text-[13px] text-slate">
            {totalCount?.toLocaleString("en-IN") ?? "—"} orders · {openCount?.toLocaleString("en-IN") ?? "—"} open
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-9 gap-[7px] text-[13px] font-medium">
            <Download className="size-[15px] text-slate" />
            Export
          </Button>
          <Button className="h-9 gap-[7px] text-[13px] tracking-[.09em] uppercase">
            <Plus className="size-[15px]" />
            New order
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-5 border-b border-line-subtle pb-3.5">
        <TabsList className="flex-wrap gap-[7px]">
          {STATUS_TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-full border border-line px-3 py-[6px] text-[12.5px] font-medium text-slate-2 data-[state=active]:border-navy data-[state=active]:bg-navy data-[state=active]:text-white"
            >
              {t}
              <span className="ml-[7px] rounded-full bg-chart-track px-[6px] text-[11px] font-semibold tabular-nums text-ash data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {tabCounts[t] ?? 0}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-wrap items-center gap-[9px]">
        <div className="relative w-[268px]">
          <Search className="pointer-events-none absolute top-1/2 left-[10px] size-[15px] -translate-y-1/2 text-ash-2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID or customer…"
            className="h-9 border-line pl-8 focus-visible:border-blue focus-visible:ring-blue/35"
          />
        </div>
        <Select value={territory} onValueChange={setTerritory}>
          <SelectTrigger className="h-9 gap-[7px] border-line text-[13px]">
            <span className="text-ash">Territory</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {(territories ?? []).map((t) => (
              <SelectItem key={t.name} value={t.name}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={company} onValueChange={setCompany}>
          <SelectTrigger className="h-9 gap-[7px] border-line text-[13px]">
            <span className="text-ash">Company</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {(companies ?? []).map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3.5">
        <DataTable
          table={table}
          isLoading={isLoading}
          error={error}
          onRowClick={(row) => navigate(`/sales-orders/${encodeURIComponent(row.name)}`)}
          emptyIcon={FileText}
          emptyTitle={`Nothing in "${tab}"`}
          emptyDescription="No sales orders match this status and filter combination."
          footer={
            <DataTablePagination page={page} pageSize={pageSize} rowCount={data.length} totalCount={totalCount} hasNextPage={hasNextPage} onPageChange={setPage} />
          }
        />
      </div>
    </div>
  );
}
