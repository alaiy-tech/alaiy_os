# Adding a screen

Every sidebar item is already routable - unbuilt ones render the shared "Coming
soon" placeholder. This walks through turning one of those placeholders into a
real list + detail screen, using **Warehouse** as the running example (swap in
whatever doctype you're actually building).

## 0. Confirm the real field names

Don't guess field names. Open the doctype in the desk (`/app/warehouse`, or
**Customize Form**) and note the fields you actually want to show - this repo
doesn't introspect doctype metadata at build time, so a typo in a field name
just silently renders `undefined`/`—` instead of erroring.

## 1. The nav entry already exists

[`src/config/navigation.ts`](../src/config/navigation.ts) already has:

```ts
{ label: "Warehouse", path: "warehouses", icon: WarehouseIcon, doctype: "Warehouse" },
```

If you're adding a brand-new item instead of upgrading a placeholder, add an
entry like this first, inside the right `NavSection`. That's the *only* place
the sidebar structure lives - `App.tsx` generates a route per item
automatically, so a new entry is clickable (as "Coming soon") the moment you
save this file.

## 2. Build the list screen

Create `src/features/warehouse/WarehouseListPage.tsx`. Use the `useDoctypeList`
hook (pagination + search state) and the generic `DataTable`:

```tsx
import { useNavigate } from "react-router-dom";
import { useDoctypeList } from "@/hooks/use-doctype-list";
import { DataTable, type DataTableColumn } from "@/components/data/DataTable";

interface WarehouseRow {
  name: string;
  warehouse_name: string;
  warehouse_type: string | null;
  disabled: 0 | 1;
}

const columns: DataTableColumn<WarehouseRow>[] = [
  { key: "warehouse_name", header: "Warehouse" },
  { key: "warehouse_type", header: "Type", render: (row) => row.warehouse_type ?? "—" },
];

export default function WarehouseListPage() {
  const navigate = useNavigate();
  const { data, isLoading, page, setPage, pageSize, hasNextPage, search, setSearch } =
    useDoctypeList<WarehouseRow>("Warehouse", {
      fields: ["name", "warehouse_name", "warehouse_type", "disabled"],
      searchField: "warehouse_name",
    });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-bold text-foreground">Warehouses</h1>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(row) => row.name}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/warehouses/${encodeURIComponent(row.name)}`)}
        searchValue={search}
        onSearchChange={setSearch}
        page={page}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        onPageChange={setPage}
      />
    </div>
  );
}
```

`DataTableColumn.render` is optional - omit it and the column falls back to
`row[key]` rendered as a plain string. Reach for `render` for badges,
currency/date formatting (see `src/lib/format.ts`), thumbnails, etc.

## 3. Build the detail screen

Create `src/features/warehouse/WarehouseDetailPage.tsx`. Fetch the single
document with `useFrappeGetDoc` and hand a plain field list to `DetailView`:

```tsx
import { useParams } from "react-router-dom";
import { useFrappeGetDoc } from "frappe-react-sdk";
import { DetailView, type DetailSection } from "@/components/data/DetailView";

interface WarehouseDoc {
  name: string;
  warehouse_name: string;
  warehouse_type: string | null;
  disabled: 0 | 1;
}

export default function WarehouseDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading } = useFrappeGetDoc<WarehouseDoc>("Warehouse", id);

  const sections: DetailSection[] = data
    ? [
        {
          heading: "Overview",
          fields: [
            { label: "Warehouse Type", value: data.warehouse_type ?? "—" },
            { label: "Status", value: data.disabled ? "Disabled" : "Active" },
          ],
        },
      ]
    : [];

  return (
    <DetailView
      title={data?.warehouse_name ?? "Loading…"}
      backHref="/warehouses"
      backLabel="Back to Warehouses"
      isLoading={isLoading}
      sections={sections}
    />
  );
}
```

`DetailView` is a layout primitive, not a metadata-driven renderer - you
choose which real fields to show and how to group them into sections. Use
`wide: true` on a field to span both columns (long text, embedded tables of
child-table rows - see `SalesOrderDetailPage.tsx` for an example rendering a
child table inside a field's `value`).

## 4. Wire the routes in `App.tsx`

Add the list screen to `BUILT_LIST_SCREENS` (keyed by the same `path` used in
`navigation.ts`) and add an explicit detail route:

```tsx
const BUILT_LIST_SCREENS: Record<string, ReactNode> = {
  // ...
  warehouses: <WarehouseListPage />,
};
```

```tsx
<Route path="warehouses/:id" element={<WarehouseDetailPage />} />
```

## 5. Add the deep-link route rule in `hooks.py`

React Router handles navigation *within* the app, but a hard refresh or a
bookmarked URL hits Frappe directly. Frappe needs to know `/os/warehouses`
and `/os/warehouses/<id>` should serve the SPA's `index.html`, not 404. Add
the path(s) to the `website_route_rules` list in
`alaiy_os/alaiy_os/hooks.py` (the comment there explains why it's an explicit
list rather than a wildcard):

```python
"warehouses",
"warehouses/<id>",
```

Restart the bench (or at least `bench clear-cache`) after editing `hooks.py`.

## 6. Rebuild

```bash
pnpm build
```

This writes straight into `alaiy_os/alaiy_os/www/os/` - refresh the browser
against your bench URL to see it live.
