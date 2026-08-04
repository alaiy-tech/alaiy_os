import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeGetDocCount, useFrappeGetDocList, type Filter } from "frappe-react-sdk";
import { type ColumnDef } from "@tanstack/react-table";
import { Download, EllipsisVertical, Package, Plus, Search } from "lucide-react";

import { useDoctypeList } from "@/hooks/use-doctype-list";
import { useDataTable } from "@/hooks/use-data-table";
import { DataTable } from "@/components/data/data-table";
import { DataTableColumnToggle } from "@/components/data/data-table-column-toggle";
import { DataTablePagination } from "@/components/data/data-table-pagination";
import { createSelectColumn } from "@/components/data/data-table-select-column";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/format";

interface ItemRow {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string;
  brand: string | null;
  stock_uom: string;
  standard_rate: number | null;
  disabled: 0 | 1;
  image: string | null;
}

function monogram(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("");
}

export default function ItemListPage() {
  const navigate = useNavigate();
  const [itemGroup, setItemGroup] = useState("All");
  const [brand, setBrand] = useState("All");
  const [status, setStatus] = useState("All");

  const { data: itemGroups } = useFrappeGetDocList<{ name: string }>("Item Group", { fields: ["name"], limit: 100 });
  const { data: brands } = useFrappeGetDocList<{ name: string }>("Brand", { fields: ["name"], limit: 100 });
  const { data: activeCount } = useFrappeGetDocCount("Item", [["disabled", "=", 0]]);
  const { data: disabledCount } = useFrappeGetDocCount("Item", [["disabled", "=", 1]]);
  const { data: itemGroupCount } = useFrappeGetDocCount("Item Group");
  const { data: brandCount } = useFrappeGetDocCount("Brand");

  const extraFilters = useMemo<Filter[]>(() => {
    const f: Filter[] = [];
    if (itemGroup !== "All") f.push(["item_group", "=", itemGroup]);
    if (brand !== "All") f.push(["brand", "=", brand]);
    if (status !== "All") f.push(["disabled", "=", status === "Disabled" ? 1 : 0]);
    return f;
  }, [itemGroup, brand, status]);

  const { data, isLoading, error, page, setPage, pageSize, hasNextPage, totalCount, search, setSearch } = useDoctypeList<ItemRow>(
    "Item",
    {
      fields: ["name", "item_code", "item_name", "item_group", "brand", "stock_uom", "standard_rate", "disabled", "image"],
      searchField: "item_name",
      orderBy: { field: "modified", order: "desc" },
      filters: extraFilters,
    },
  );

  const columns = useMemo<ColumnDef<ItemRow>[]>(
    () => [
      createSelectColumn<ItemRow>(),
      {
        id: "item",
        header: "Item",
        meta: { label: "Item" },
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center gap-[11px]">
              {r.image ? (
                <img src={r.image} alt="" className="size-[34px] flex-none rounded-[7px] border border-line object-cover" />
              ) : (
                <span className="flex size-[34px] flex-none items-center justify-center rounded-[7px] border border-line bg-line-subtle text-[11.5px] font-semibold tracking-[.02em] text-navy">
                  {monogram(r.item_name)}
                </span>
              )}
              <div className="min-w-0">
                <div className="max-w-[290px] truncate text-[13px] font-medium tracking-[-.012em] text-ink">{r.item_name}</div>
                <div className="mt-0.5 text-[11.5px] tabular-nums text-ash-2">{r.item_code}</div>
              </div>
            </div>
          );
        },
      },
      { accessorKey: "item_group", header: "Item group", meta: { label: "Item group" }, cell: ({ getValue }) => (
        <span className="text-[13px] text-slate-2">{getValue<string>()}</span>
      ) },
      { accessorKey: "brand", header: "Brand", meta: { label: "Brand" }, cell: ({ getValue }) => (
        <span className="text-[13px] text-slate-2">{getValue<string | null>() ?? "—"}</span>
      ) },
      { accessorKey: "stock_uom", header: "UOM", meta: { label: "UOM" }, cell: ({ getValue }) => (
        <span className="text-[12.5px] text-ash">{getValue<string>()}</span>
      ) },
      {
        accessorKey: "standard_rate",
        header: "Standard rate",
        meta: { label: "Standard rate" },
        cell: ({ getValue }) => <span className="text-[13px] tabular-nums text-ink">{formatCurrency(getValue<number | null>()) ?? "—"}</span>,
      },
      {
        id: "status",
        header: "Status",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.disabled ? (
            <Badge variant="neutral">Disabled</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex size-7 items-center justify-center rounded-md text-ash transition-colors hover:bg-line-subtle hover:text-ink">
                  <EllipsisVertical className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[176px]">
                <DropdownMenuItem onSelect={() => navigate(`/products/${encodeURIComponent(row.original.name)}`)}>Open item</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigator.clipboard.writeText(row.original.item_code)}>Copy item code</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-danger-fg">
                  Disable item
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
          <h1 className="text-[26px] font-semibold tracking-[-.025em] text-ink">Products</h1>
          <p className="mt-[5px] text-[13px] text-slate">
            Item doctype · {totalCount?.toLocaleString("en-IN") ?? "—"} records · {itemGroupCount ?? "—"} item groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-9 gap-[7px] text-[13px] font-medium">
            <Download className="size-[15px] text-slate" />
            Export
          </Button>
          <Button className="h-9 gap-[7px] text-[13px] tracking-[.09em] uppercase">
            <Plus className="size-[15px]" />
            New item
          </Button>
        </div>
      </div>

      <div className="mt-[22px] grid grid-cols-4 gap-3.5">
        {[
          { label: "Active SKUs", value: activeCount },
          { label: "Disabled", value: disabledCount },
          { label: "Item groups", value: itemGroupCount },
          { label: "Brands", value: brandCount },
        ].map((k) => (
          <div key={k.label} className="rounded-[10px] border border-line-subtle bg-background p-[15px] px-[17px]">
            <div className="text-[11.5px] font-medium tracking-[.06em] text-ash uppercase">{k.label}</div>
            <div className="mt-[9px] text-[22px] font-semibold tabular-nums tracking-[-.03em] text-ink">
              {k.value !== undefined ? k.value.toLocaleString("en-IN") : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-[9px]">
        <div className="relative w-[268px]">
          <Search className="pointer-events-none absolute top-1/2 left-[10px] size-[15px] -translate-y-1/2 text-ash-2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item name or code…"
            className="h-9 border-line pl-8 focus-visible:border-blue focus-visible:ring-blue/35"
          />
        </div>
        <Select value={itemGroup} onValueChange={setItemGroup}>
          <SelectTrigger className="h-9 gap-[7px] border-line text-[13px]">
            <span className="text-ash">Item group</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {(itemGroups ?? []).map((g) => (
              <SelectItem key={g.name} value={g.name}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="h-9 gap-[7px] border-line text-[13px]">
            <span className="text-ash">Brand</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {(brands ?? []).map((b) => (
              <SelectItem key={b.name} value={b.name}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 gap-[7px] border-line text-[13px]">
            <span className="text-ash">Status</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <DataTableColumnToggle table={table} />
      </div>

      <div className="mt-3.5">
        <DataTable
          table={table}
          isLoading={isLoading}
          error={error}
          onRowClick={(row) => navigate(`/products/${encodeURIComponent(row.name)}`)}
          emptyIcon={Package}
          emptyTitle="No items match these filters"
          emptyDescription="Try a different item group, or clear the search."
          footer={
            <DataTablePagination page={page} pageSize={pageSize} rowCount={data.length} totalCount={totalCount} hasNextPage={hasNextPage} onPageChange={setPage} />
          }
        />
      </div>
    </div>
  );
}
