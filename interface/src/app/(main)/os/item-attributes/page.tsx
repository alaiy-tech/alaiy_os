import { PageHeader } from "@/components/layout/page-header";

import { ItemAttributesView } from "./_components/item-attributes-view";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Item Attributes"
        subtitle="Manage the attributes your item variants are built from, and the values each one allows."
      />
      <ItemAttributesView />
    </div>
  );
}
