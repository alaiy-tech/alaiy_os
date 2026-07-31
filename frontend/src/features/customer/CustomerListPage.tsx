import { useNavigate } from "react-router-dom";

import { useDoctypeList } from "@/hooks/use-doctype-list";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";

interface CustomerRow {
  name: string;
  customer_name: string;
  customer_type: string;
  customer_group: string;
  territory: string;
  disabled: 0 | 1;
}

const columns: DataTableColumn<CustomerRow>[] = [
  { key: "customer_name", header: "Customer" },
  { key: "customer_type", header: "Type" },
  { key: "customer_group", header: "Group" },
  { key: "territory", header: "Territory" },
  {
    key: "disabled",
    header: "Status",
    render: (row) => <Badge variant={row.disabled ? "outline" : "success"}>{row.disabled ? "Disabled" : "Active"}</Badge>,
  },
];

export default function CustomerListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, page, setPage, pageSize, hasNextPage, search, setSearch } = useDoctypeList<CustomerRow>("Customer", {
    fields: ["name", "customer_name", "customer_type", "customer_group", "territory", "disabled"],
    searchField: "customer_name",
    orderBy: { field: "modified", order: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Customers</h1>
        <p className="text-sm text-muted-foreground">Customer doctype</p>
      </div>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.name}
        isLoading={isLoading}
        error={error}
        onRowClick={(row) => navigate(`/customers/${encodeURIComponent(row.name)}`)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by customer name…"
        page={page}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        onPageChange={setPage}
        emptyMessage="No customers found."
      />
    </div>
  );
}
