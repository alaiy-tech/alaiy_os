import { useParams } from "react-router-dom";
import { useFrappeGetDoc } from "frappe-react-sdk";

import { DetailView, type DetailSection } from "@/components/data/DetailView";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

interface SalesOrderItem {
  name: string;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
}

interface SalesOrderDoc {
  name: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string | null;
  order_type: string;
  status: string;
  company: string;
  currency: string;
  total: number;
  total_taxes_and_charges: number;
  grand_total: number;
  items: SalesOrderItem[];
  owner: string;
  creation: string;
}

export default function SalesOrderDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useFrappeGetDoc<SalesOrderDoc>("Sales Order", id);

  const sections: DetailSection[] = data
    ? [
        {
          heading: "Overview",
          fields: [
            { label: "Customer", value: data.customer_name || data.customer },
            { label: "Order Type", value: data.order_type },
            { label: "Order Date", value: formatDate(data.transaction_date) },
            { label: "Delivery Date", value: formatDate(data.delivery_date) ?? "—" },
            { label: "Company", value: data.company },
          ],
        },
        {
          heading: "Totals",
          fields: [
            { label: "Total", value: formatCurrency(data.total, data.currency) },
            { label: "Taxes & Charges", value: formatCurrency(data.total_taxes_and_charges, data.currency) },
            { label: "Grand Total", value: formatCurrency(data.grand_total, data.currency) },
          ],
        },
        {
          heading: "Items",
          fields: [
            {
              label: "Items",
              wide: true,
              value: (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data.items ?? []).map((item) => (
                      <TableRow key={item.name}>
                        <TableCell>{item.item_code}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.qty}</TableCell>
                        <TableCell>{formatCurrency(item.rate, data.currency)}</TableCell>
                        <TableCell>{formatCurrency(item.amount, data.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ),
            },
          ],
        },
      ]
    : [];

  return (
    <DetailView
      title={data?.name ?? "Loading…"}
      subtitle={data?.customer_name}
      backHref="/sales-orders"
      backLabel="Back to Sales Orders"
      isLoading={isLoading}
      error={error}
      sections={sections}
      actions={data && <Badge>{data.status}</Badge>}
    />
  );
}
