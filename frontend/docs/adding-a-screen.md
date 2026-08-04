# Adding a screen

Every sidebar item is already routable - unbuilt ones render the shared
`ComingSoonPage` (built on shadcn's `Empty` component), showing which
planned template (T1-T10, see `src/config/templates.ts`) the design assigned
it. This walks through turning one of those placeholders into a real list +
detail screen, using **Warehouse** (currently `T4 variant — profile per
warehouse`) as the running example - swap in whatever doctype you're
actually building.

## 0. Confirm the real field names

Don't guess field names. Open the doctype in the desk (`/app/warehouse`, or
**Customize Form**) and note the fields you actually want to show - this repo
doesn't introspect doctype metadata at build time, so a typo in a field name
just silently renders `undefined`/`—` instead of erroring.

**Don't fabricate numbers for fields that need backend aggregation.** Several
values in the approved design (stock value, revenue-by-period, activity
timelines) aren't simple Item/Customer/Sales Order fields - they need a Bin
join, a date-range sum, or Frappe's version/timeline API. Where that's not a
cheap, honest query, either compute a real substitute (see
`ItemDetailPage.tsx`'s stat cards, which sum real `Bin` rows instead of
inventing a "valuation" number) or show an explicit `Empty` state saying it
isn't wired yet (see `CustomerDetailPage.tsx`'s Contacts/Activity tabs). Never
hardcode a plausible-looking number for a doctype that has a live backend.

## 1. The nav entry already exists

[`src/config/navigation.ts`](../src/config/navigation.ts) already has:

```ts
{ label: "Warehouse", path: "warehouses", icon: WarehouseIcon, doctype: "Warehouse", template: "T4 variant — profile per warehouse" },
```

If you're adding a brand-new item instead of upgrading a placeholder, add an
entry like this first, inside the right `NavSection` (drop the `template`
field once you build the real screen - it's what tells `ComingSoonPage`
which wireframe to show). That's the *only* place the sidebar structure
lives - `App.tsx` generates a route per item automatically, so a new entry
is clickable (as "Coming soon") the moment you save this file.

## 2. Build the list screen

Create `src/features/warehouse/WarehouseListPage.tsx`. The generic table
stack is three pieces:

- `useDoctypeList` - pagination, search, and extra-filter state, wrapping
  `frappe-react-sdk`'s `useFrappeGetDocList` + `useFrappeGetDocCount`
- `useDataTable` - wraps TanStack Table's `useReactTable` with column
  visibility + row-selection state
- `<DataTable table={table} .../>` - presentational renderer; pass
  `<DataTableColumnToggle table={table} />` in your toolbar and
  `<DataTablePagination .../>` as its `footer` prop

```tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Warehouse as WarehouseIcon } from "lucide-react";

import { useDoctypeList } from "@/hooks/use-doctype-list";
import { useDataTable } from "@/hooks/use-data-table";
import { DataTable } from "@/components/data/data-table";
import { DataTableColumnToggle } from "@/components/data/data-table-column-toggle";
import { DataTablePagination } from "@/components/data/data-table-pagination";
import { Badge } from "@/components/ui/badge";

interface WarehouseRow {
  name: string;
  warehouse_name: string;
  warehouse_type: string | null;
  disabled: 0 | 1;
}

export default function WarehouseListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, page, setPage, pageSize, hasNextPage, totalCount } =
    useDoctypeList<WarehouseRow>("Warehouse", {
      fields: ["name", "warehouse_name", "warehouse_type", "disabled"],
      searchField: "warehouse_name",
    });

  const columns = useMemo<ColumnDef<WarehouseRow>[]>(
    () => [
      { accessorKey: "warehouse_name", header: "Warehouse" },
      { accessorKey: "warehouse_type", header: "Type", meta: { label: "Type" }, cell: ({ getValue }) => getValue<string | null>() ?? "—" },
      {
        accessorKey: "disabled",
        header: "Status",
        cell: ({ getValue }) => (getValue<number>() ? <Badge variant="neutral">Disabled</Badge> : <Badge variant="success">Active</Badge>),
      },
    ],
    [],
  );

  const table = useDataTable({ columns, data, getRowId: (r) => r.name });

  return (
    <div className="max-w-[1520px] px-8 pt-7 pb-14">
      <h1 className="text-[26px] font-semibold tracking-[-.025em] text-ink">Warehouses</h1>
      <div className="mt-5 flex justify-end">
        <DataTableColumnToggle table={table} />
      </div>
      <div className="mt-3.5">
        <DataTable
          table={table}
          isLoading={isLoading}
          error={error}
          onRowClick={(row) => navigate(`/warehouses/${encodeURIComponent(row.name)}`)}
          emptyIcon={WarehouseIcon}
          footer={<DataTablePagination page={page} pageSize={pageSize} rowCount={data.length} totalCount={totalCount} hasNextPage={hasNextPage} onPageChange={setPage} />}
        />
      </div>
    </div>
  );
}
```

A column only needs `meta: { label }` if you want it to appear (with a
friendlier name than its id) in the Columns-toggle dropdown - mark generic
columns like the status badge with no `meta` and they'll always show. Reach
for `cell` for badges, currency/date formatting (see `src/lib/format.ts` and
`src/lib/status.ts`), thumbnails, etc. Need a filter dropdown or a status tab
strip? See `ItemListPage.tsx` (shadcn `Select`, populated from a real
`Item Group`/`Brand` fetch) and `SalesOrderListPage.tsx` (shadcn `Tabs` with
real per-status counts via `useStatusCounts`).

## 3. Build the detail screen

Create `src/features/warehouse/WarehouseDetailPage.tsx`. Fetch the single
document with `useFrappeGetDoc` (which returns child tables too - no extra
query needed for those) and hand a field list to `DetailView`:

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
  const { data, isLoading, error } = useFrappeGetDoc<WarehouseDoc>("Warehouse", id);

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
      backLabel="Warehouses"
      isLoading={isLoading}
      error={error}
      sections={sections}
    />
  );
}
```

`DetailView` is a layout primitive, not a metadata-driven renderer - you
choose which real fields to show and how to group them into sections.
- `wide: true` spans both grid columns (long text).
- `bare: true` skips the label/value wrapper entirely - use it to embed a
  full `<Table>` of child-table rows (see `SalesOrderDetailPage.tsx`'s Items
  section) or any other custom block.
- The `leading` prop puts a small visual (image, avatar) beside the title;
  `children` renders between the header and the section grid (see
  `ItemDetailPage.tsx`'s stat-card row, or `CustomerDetailPage.tsx`'s tag
  chips + stats + `Tabs`).

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

Then delete the `template` field from that item in `navigation.ts` - it's
only read by `ComingSoonPage`.

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
