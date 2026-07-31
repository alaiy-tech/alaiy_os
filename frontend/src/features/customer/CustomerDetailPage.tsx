import { useParams } from "react-router-dom";
import { useFrappeGetDoc } from "frappe-react-sdk";

import { DetailView, type DetailSection } from "@/components/data/DetailView";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

interface CustomerDoc {
  name: string;
  customer_name: string;
  customer_type: string;
  customer_group: string;
  territory: string;
  default_currency: string | null;
  default_price_list: string | null;
  disabled: 0 | 1;
  is_frozen: 0 | 1;
  owner: string;
  creation: string;
  modified: string;
}

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useFrappeGetDoc<CustomerDoc>("Customer", id);

  const sections: DetailSection[] = data
    ? [
        {
          heading: "Overview",
          fields: [
            { label: "Customer Type", value: data.customer_type },
            { label: "Customer Group", value: data.customer_group },
            { label: "Territory", value: data.territory },
            { label: "Default Currency", value: data.default_currency ?? "—" },
          ],
        },
        {
          heading: "Settings",
          fields: [
            { label: "Default Price List", value: data.default_price_list ?? "—" },
            { label: "Frozen", value: data.is_frozen ? "Yes" : "No" },
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
      title={data?.customer_name ?? "Loading…"}
      subtitle={data?.customer_group}
      backHref="/customers"
      backLabel="Back to Customers"
      isLoading={isLoading}
      error={error}
      sections={sections}
      actions={data && <Badge variant={data.disabled ? "outline" : "success"}>{data.disabled ? "Disabled" : "Active"}</Badge>}
    />
  );
}
