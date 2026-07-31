import { useParams } from "react-router-dom";
import { useFrappeGetDoc } from "frappe-react-sdk";
import { Package } from "lucide-react";

import { DetailView, type DetailSection } from "@/components/data/DetailView";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";

interface ItemDoc {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string;
  stock_uom: string;
  brand: string | null;
  disabled: 0 | 1;
  image: string | null;
  description: string | null;
  standard_rate: number | null;
  weight_per_unit: number | null;
  weight_uom: string | null;
  creation: string;
  modified: string;
  owner: string;
}

export default function ItemDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useFrappeGetDoc<ItemDoc>("Item", id);

  const sections: DetailSection[] = data
    ? [
        {
          heading: "Overview",
          fields: [
            { label: "Item Code", value: data.item_code },
            { label: "Item Group", value: data.item_group },
            { label: "Brand", value: data.brand ?? "—" },
            { label: "Stock UOM", value: data.stock_uom },
          ],
        },
        {
          heading: "Description",
          fields: [{ label: "Description", value: data.description || "—", wide: true }],
        },
        {
          heading: "Pricing",
          fields: [{ label: "Standard Rate", value: formatCurrency(data.standard_rate) ?? "—" }],
        },
        {
          heading: "Physical",
          fields: [
            { label: "Weight per Unit", value: data.weight_per_unit ?? "—" },
            { label: "Weight UOM", value: data.weight_uom ?? "—" },
          ],
        },
        {
          heading: "Meta",
          fields: [
            { label: "Owner", value: data.owner },
            { label: "Created", value: formatDate(data.creation) },
            { label: "Last Modified", value: formatDate(data.modified) },
          ],
        },
      ]
    : [];

  return (
    <DetailView
      title={data?.item_name ?? "Loading…"}
      subtitle={data?.item_code}
      backHref="/products"
      backLabel="Back to Products"
      isLoading={isLoading}
      error={error}
      sections={sections}
      actions={
        data && (
          <div className="flex items-center gap-3">
            <Badge variant={data.disabled ? "outline" : "success"}>{data.disabled ? "Disabled" : "Active"}</Badge>
            {data.image ? (
              <img src={data.image} alt="" className="size-14 rounded-md border border-border object-cover" />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-md bg-secondary">
                <Package className="size-6 text-muted-foreground" />
              </div>
            )}
          </div>
        )
      }
    />
  );
}
