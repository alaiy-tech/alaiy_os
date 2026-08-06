import { getRootItemGroup } from "@/lib/frappe/server";

import { ItemGroupsView } from "./_components/item-groups-view";

export default async function Page() {
  const root = await getRootItemGroup();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold leading-none tracking-tight">Item Groups</h1>
        <p className="text-muted-foreground text-sm">Organize your catalog into a category hierarchy.</p>
      </div>
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
