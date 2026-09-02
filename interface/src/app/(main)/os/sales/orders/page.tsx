import { PageHeader } from "@/components/layout/page-header";

import { SalesOrders } from "./_components/sales-orders";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales Orders"
        subtitle="Track order volume, value, and delivery commitments across your sales cycle."
      />
      <SalesOrders />
    </div>
  );
}
