import { PageHeader } from "@/components/layout/page-header";

import { PurchaseOrders } from "./_components/purchase-orders";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchase Orders"
        subtitle="Track what's ordered, pending receipt, and awaiting payment across your procurement cycle."
      />
      <PurchaseOrders />
    </div>
  );
}
