import { useNavigate } from "react-router-dom";

import { useDoctypeList } from "@/hooks/use-doctype-list";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";

interface SalesOrderRow {
  name: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string | null;
  status: string;
  grand_total: number;
  currency: string;
}

const statusVariant: Record<string, "success" | "warning" | "outline" | "secondary"> = {
  Completed: "success",
  Closed: "success",
  "To Deliver and Bill": "warning",
  "To Bill": "warning",
  "To Deliver": "warning",
  "On Hold": "outline",
  Cancelled: "outline",
  Draft: "secondary",
};

const columns: DataTableColumn<SalesOrderRow>[] = [
  { key: "name", header: "Order" },
  { key: "customer_name", header: "Customer", render: (row) => row.customer_name || row.customer },
  { key: "transaction_date", header: "Order Date", render: (row) => formatDate(row.transaction_date) },
  { key: "delivery_date", header: "Delivery Date", render: (row) => formatDate(row.delivery_date) ?? "—" },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge variant={statusVariant[row.status] ?? "secondary"}>{row.status}</Badge>,
  },
  { key: "grand_total", header: "Grand Total", render: (row) => formatCurrency(row.grand_total, row.currency) },
];

export default function SalesOrderListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, page, setPage, pageSize, hasNextPage, search, setSearch } = useDoctypeList<SalesOrderRow>("Sales Order", {
    fields: ["name", "customer", "customer_name", "transaction_date", "delivery_date", "status", "grand_total", "currency"],
    searchField: "customer_name",
    orderBy: { field: "transaction_date", order: "desc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Sales Orders</h1>
        <p className="text-sm text-muted-foreground">Sales Order doctype</p>
      </div>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.name}
        isLoading={isLoading}
        error={error}
        onRowClick={(row) => navigate(`/sales-orders/${encodeURIComponent(row.name)}`)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by customer…"
        page={page}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        onPageChange={setPage}
        emptyMessage="No sales orders found."
      />
    </div>
  );
}
