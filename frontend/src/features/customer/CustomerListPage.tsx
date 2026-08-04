import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeGetDocList, type Filter } from "frappe-react-sdk";
import { type ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Download, Plus, Search, Users } from "lucide-react";

import { useDoctypeList } from "@/hooks/use-doctype-list";
import { useDataTable } from "@/hooks/use-data-table";
import { DataTable } from "@/components/data/data-table";
import { DataTablePagination } from "@/components/data/data-table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

interface CustomerRow {
  name: string;
  customer_name: string;
  customer_type: string;
  customer_group: string;
  territory: string;
  default_currency: string | null;
  disabled: 0 | 1;
  creation: string;
}

function initials(value: string) {
  return value.split(" ").slice(0, 2).map((w) => w[0]).join("");
}

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [chip, setChip] = useState("All");

  const { data: groups } = useFrappeGetDocList<{ name: string }>("Customer Group", { fields: ["name"], limit: 30 });
  const chips = ["All", ...(groups ?? []).slice(0, 5).map((g) => g.name)];

  const extraFilters = useMemo<Filter[]>(() => (chip === "All" ? [] : [["customer_group", "=", chip]]), [chip]);

  const { data, isLoading, error, page, setPage, pageSize, hasNextPage, totalCount, search, setSearch } = useDoctypeList<CustomerRow>(
    "Customer",
    {
      fields: ["name", "customer_name", "customer_type", "customer_group", "territory", "default_currency", "disabled", "creation"],
      searchField: "customer_name",
      orderBy: { field: "modified", order: "desc" },
      filters: extraFilters,
    },
  );

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        id: "customer",
        header: "Customer",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-[11px]">
              <span className="flex size-8 flex-none items-center justify-center rounded-full border border-line bg-line-subtle text-[11.5px] font-semibold tracking-[.02em] text-navy">
                {initials(r.customer_name)}
              </span>
              <div className="min-w-0">
                <div className="max-w-[250px] truncate text-[13px] font-medium tracking-[-.012em] text-ink">{r.customer_name}</div>
                <div className="mt-0.5 text-[11.5px] text-ash-2">
                  {r.customer_type} · since {formatDate(r.creation)}
                </div>
              </div>
            </div>
          );
        },
      },
      { accessorKey: "customer_group", header: "Group", cell: ({ getValue }) => <span className="text-slate-2">{getValue<string>()}</span> },
      { accessorKey: "territory", header: "Territory", cell: ({ getValue }) => <span className="text-slate-2">{getValue<string>()}</span> },
      {
        accessorKey: "default_currency",
        header: "Currency",
        cell: ({ getValue }) => <span className="text-[12.5px] text-ash">{getValue<string | null>() ?? "—"}</span>,
      },
      {
        accessorKey: "disabled",
        header: "Status",
        cell: ({ getValue }) => (getValue<number>() ? <Badge variant="neutral">Disabled</Badge> : <Badge variant="success">Active</Badge>),
      },
      {
        id: "chevron",
        header: "",
        cell: () => <ChevronRight className="size-4 text-line-hover" />,
      },
    ],
    [],
  );

  const table = useDataTable({ columns, data, getRowId: (r) => r.name });

  return (
    <div className="max-w-[1520px] px-8 pt-7 pb-14">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-.025em] text-ink">Customer</h1>
          <p className="mt-[5px] text-[13px] text-slate">
            {totalCount?.toLocaleString("en-IN") ?? "—"} accounts · {groups?.length ?? "—"} customer groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-9 gap-[7px] text-[13px] font-medium">
            <Download className="size-[15px] text-slate" />
            Export
          </Button>
          <Button className="h-9 gap-[7px] text-[13px] tracking-[.09em] uppercase">
            <Plus className="size-[15px]" />
            New customer
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-[9px]">
        <div className="relative w-[268px]">
          <Search className="pointer-events-none absolute top-1/2 left-[10px] size-[15px] -translate-y-1/2 text-ash-2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name…"
            className="h-9 border-line pl-8 focus-visible:border-blue focus-visible:ring-blue/35"
          />
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              className={
                c === chip
                  ? "rounded-full border border-navy bg-navy px-[13px] py-[7px] text-[12.5px] font-medium text-white"
                  : "rounded-full border border-line px-[13px] py-[7px] text-[12.5px] font-medium text-slate-2 transition-colors hover:border-line-hover"
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3.5">
        <DataTable
          table={table}
          isLoading={isLoading}
          error={error}
          onRowClick={(row) => navigate(`/customers/${encodeURIComponent(row.name)}`)}
          emptyIcon={Users}
          emptyTitle="No customers match"
          emptyDescription="Try a different group or clear the search."
          footer={
            <DataTablePagination page={page} pageSize={pageSize} rowCount={data.length} totalCount={totalCount} hasNextPage={hasNextPage} onPageChange={setPage} />
          }
        />
      </div>
    </div>
  );
}
