import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";

import { useDoctypeList } from "@/hooks/use-doctype-list";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";

interface ItemRow {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  brand: string | null;
  disabled: 0 | 1;
  image: string | null;
}

const columns: DataTableColumn<ItemRow>[] = [
  {
    key: "image",
    header: "",
    className: "w-12",
    render: (row) =>
      row.image ? (
        <img src={row.image} alt="" className="size-8 rounded-md border border-border object-cover" />
      ) : (
        <div className="flex size-8 items-center justify-center rounded-md bg-secondary">
          <Package className="size-4 text-muted-foreground" />
        </div>
      ),
  },
  { key: "item_code", header: "Item Code" },
  { key: "item_name", header: "Item Name" },
  { key: "item_group", header: "Group" },
  { key: "stock_uom", header: "UOM" },
  { key: "brand", header: "Brand", render: (row) => row.brand ?? "—" },
  {
    key: "disabled",
    header: "Status",
    render: (row) => <Badge variant={row.disabled ? "outline" : "success"}>{row.disabled ? "Disabled" : "Active"}</Badge>,
  },
];

export default function ItemListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, page, setPage, pageSize, hasNextPage, search, setSearch } = useDoctypeList<ItemRow>("Item", {
    fields: ["name", "item_code", "item_name", "item_group", "stock_uom", "brand", "disabled", "image"],
    searchField: "item_name",
    orderBy: { field: "modified", order: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground">Item doctype</p>
      </div>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.name}
        isLoading={isLoading}
        error={error}
        onRowClick={(row) => navigate(`/products/${encodeURIComponent(row.name)}`)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by item name…"
        page={page}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        onPageChange={setPage}
        emptyMessage="No items found."
      />
    </div>
  );
}
