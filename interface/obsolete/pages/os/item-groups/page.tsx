import { PageHeader } from "@/components/layout/page-header";
import { getRootItemGroup } from "@/lib/frappe/server";

import { ItemGroupsView } from "./_components/item-groups-view";

export default async function Page() {
  const root = await getRootItemGroup();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Item Groups" subtitle="Organize your catalog into a category hierarchy." />
      {root ? (
        <ItemGroupsView rootName={root.name} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Could not load Item Groups. Make sure you&apos;re signed in and try again.
        </p>
      )}
    </div>
  );
}
