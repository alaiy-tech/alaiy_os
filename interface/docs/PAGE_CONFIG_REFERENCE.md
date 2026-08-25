# Alaiy OS Page Configuration Reference

> **Audience**: Any AI model (or developer) building a `PageConfigFile` /
> `UIPageDefinition` for the Alaiy OS headless-runtime. This document is
> the single source of truth — after reading it you should be able to author
> a valid page config without inspecting source code.

---

## Table of Contents

1. [Top-Level Shape: `PageConfigFile`](#1-top-level-shape-pageconfigfile)
2. [The Definition: `UIPageDefinition`](#2-the-definition-uipagedefinition)
3. [Node Types: Layout vs Component](#3-node-types-layout-vs-component)
4. [Layout Registry](#4-layout-registry)
5. [Component Registry](#5-component-registry)
   - [os-page-header](#os-page-header)
   - [os-card](#os-card)
   - [os-kpi](#os-kpi)
   - [os-dynamic-badge](#os-dynamic-badge)
   - [os-data-table](#os-data-table)
   - [os-chart](#os-chart)
   - [os-filter-bar](#os-filter-bar)
   - [os-period-toggle](#os-period-toggle)
6. [Data Layer](#6-data-layer)
   - [Named Page-Level Data Definitions](#named-page-level-data-definitions)
   - [DataRequest — three operation types](#datarequest--three-operation-types)
   - [QueryBinding — URL-driven request state](#querybinding--url-driven-request-state)
   - [TransformStep — pipeline steps](#transformstep--pipeline-steps)
   - [DataSourceRef — binding a data definition to a prop](#datasourceref--binding-a-data-definition-to-a-prop)
   - [Registered (Domain-Specific) Sources](#registered-domain-specific-sources)
7. [Responsive Layout Values](#7-responsive-layout-values)
8. [Sentinel Substitution](#8-sentinel-substitution)
9. [Validation Rules & Gotchas](#9-validation-rules--gotchas)
10. [Full Example — Dashboard Page](#10-full-example--dashboard-page)

---

## 1. Top-Level Shape: `PageConfigFile`

```ts
type PageConfigFile = {
  id: string;                          // unique page identifier, e.g. "dashboard"
  route: string;                       // must start with "/", e.g. "/os" or "/os/customers"
  metadata?: {
    title?: string;
    description?: string;
  };
  definition: UIPageDefinition;        // the whole tree
};
```

The `id` and `route` must both be **globally unique** across all pages.  
`route` must start with `/`.

---

## 2. The Definition: `UIPageDefinition`

```ts
type UIPageDefinition = {
  id: string;                          // unique within this file; NOT the same as PageConfigFile.id
  kind: "page";                        // always the literal string "page"
  data?: Record<string, DataDefinition>; // named, page-scoped data entries (see §6)
  children: UINode[];                  // top-level layout/component nodes
};
```

`children` is the direct content of the page. The outermost child is almost
always a **layout node** (usually `type: "stack"`), not a raw component.

---

## 3. Node Types: Layout vs Component

Every element in the tree is either a **layout node** (structural, no
business logic) or a **component node** (rendered UI element).

### Layout Node

```ts
type LayoutNode = {
  id: string;                 // must be unique across the ENTIRE page tree
  kind: "layout";             // always "layout"
  type: LayoutType;           // "section" | "stack" | "inline" | "grid"
  columns?: ResponsiveValue;  // only meaningful for type:"grid"
  layout?: { span?: ResponsiveValue }; // how this node occupies its parent grid
  children: UINode[];         // required, may be empty
};
```

### Component Node

```ts
type ComponentNode = {
  id: string;                           // unique across the ENTIRE page tree
  kind: "component";                    // always "component"
  type: ComponentType;                  // see §5 for the full vocabulary
  layout?: { span?: ResponsiveValue };  // grid span within its parent
  props?: Record<string, unknown>;      // static, literal prop values
  data?: Record<string, DataSourceRef>; // data-bound prop values (see §6)
  children?: UINode[];                  // only if registry entry supports children
};
```

**Rule**: Every `id` across the entire page (definition id + every node id)
must be unique. A duplicate id is a hard validation error.

---

## 4. Layout Registry

Four layout types are available. Each becomes a `<div>` with the described
Tailwind classes.

| `type`    | Visual behaviour                                              | `columns`? | Notes |
|-----------|---------------------------------------------------------------|:----------:|-------|
| `stack`   | `flex flex-col gap-4` — vertical, full-width children        | No         | Default outer wrapper for a page |
| `section` | `flex flex-col gap-4` — identical to `stack`; semantic only  | No         | Use for logical grouping |
| `inline`  | `flex flex-wrap items-end justify-end gap-2` — horizontal    | No         | The header action row: filters + toggles |
| `grid`    | `grid gap-4` + responsive `grid-cols-*`                      | **Yes**    | Set `columns` (see §7) |

### Grid `columns` — supported values only

The runtime uses a **static class lookup** (no dynamic generation). Only
these column counts are safe:

| Breakpoint | Supported values |
|------------|-----------------|
| `base`     | `1`             |
| `md`       | `2`, `3`        |
| `xl`       | `4`, `12`       |

Example: `columns: { base: 1, xl: 12 }` — 1 column on mobile, 12-column grid on xl.

### Layout `span` — supported values only

Same static-class constraint. Only these span values render correctly:

| Breakpoint | Supported values       |
|------------|------------------------|
| `xl`       | `5`, `6`, `7`, `12`    |

Example: `layout: { span: { xl: 7 } }` — spans 7 of 12 columns at xl.

---

## 5. Component Registry

Eight components are registered and AI-exposed. Every component node sets
`kind: "component"` and a `type` string from the list below.

Props marked **[required]** must be present as either a literal `props` key
**or** a `data` binding key — either satisfies the requirement.

---

### `os-page-header`

> Page title, optional subtitle, and a right-aligned action slot.  
> **Use once per page.**

**Allowed parents**: `stack`, `section`  
**Supports children**: yes — children render into the `action` slot (right-aligned area)  
**Required fields**: `title`

#### Props

| Key        | Type     | Description |
|------------|----------|-------------|
| `title`    | `string` | **[required]** The main page heading |
| `subtitle` | `string` | Optional secondary text below the title |

#### Typical usage

```jsonc
{
  "id": "page-header",
  "kind": "component",
  "type": "os-page-header",
  "props": { "title": "Dashboard" },
  "children": [
    {
      "id": "header-actions",
      "kind": "layout",
      "type": "inline",
      "children": [ /* os-filter-bar, os-period-toggle, etc. */ ]
    }
  ]
}
```

---

### `os-card`

> Generic chrome wrapper with a title bar and content area for **one child component**.

**Allowed parents**: `grid`, `stack`, `section`, `inline`  
**Supports children**: yes — children render into the `children` slot  
**Required fields**: none

#### Props

| Key        | Type     | Description |
|------------|----------|-------------|
| `title`    | `string` | Optional card heading |
| `className`| `string` | Optional extra Tailwind class string |

---

### `os-kpi`

> A single business metric: a value, optional format, and optional trend delta.

**Allowed parents**: `grid`, `stack`, `section`  
**Supports children**: no  
**Required fields**: `title`, `value`

#### Props

| Key             | Type                                        | Default     | Description |
|-----------------|---------------------------------------------|-------------|-------------|
| `title`         | `string`                                    | —           | **[required]** Metric label |
| `value`         | `number \| string`                          | —           | **[required]** The raw value |
| `icon`          | `KpiIconName` (see below)                   | —           | Lucide icon name (PascalCase) |
| `format`        | `"number" \| "currency" \| "percent"`       | —           | How to display `value` |
| `currency`      | `string`                                    | —           | Currency code, e.g. `"INR"` |
| `precision`     | `number`                                    | —           | Decimal places |
| `trend`         | `number \| null`                            | —           | Pre-computed delta (positive = up) |
| `trendUnit`     | `"percent" \| "points"`                     | —           | Unit for the trend label |
| `trendPolarity` | `"positive" \| "negative"`                  | `"positive"`| Whether up = good (`"positive"`) or bad (`"negative"`) |
| `trendLabel`    | `string`                                    | —           | Override the trend label text |
| `borderTone`    | `"primary" \| "success" \| "warning" \| "caution" \| "destructive" \| "info"` | — | Accent bar colour |

#### Valid `icon` values (KpiIconName)

`DollarSign`, `ShoppingBag`, `Users`, `UsersRound`, `ReceiptText`,
`RotateCcw`, `PackageCheck`, `Package`, `TrendingUp`, `TrendingDown`,
`Wallet`, `Banknote`, `Boxes`, `Warehouse`, `Truck`, `PackageSearch`,
`Factory`, `Ship`, `Store`, `Globe`, `MapPin`, `Calendar`, `Clock`,
`FileText`, `ScrollText`, `Database`, `Server`, `Award`, `Star`, `Gift`,
`Zap`, `Scale`, `BarChart3`, `PieChart`, `Building2`, `Briefcase`, `Mail`,
`Phone`, `Bell`, `Filter`, `Layers`, `Grid`, `List`, `Link`, `Download`,
`Upload`, `ExternalLink`, `HelpCircle`, `Info`, `FolderTree`, `Forklift`

---

### `os-dynamic-badge`

> A badge whose colour is resolved from its `content` string and `category`.

**Allowed parents**: `grid`, `stack`, `section`, `inline`  
**Supports children**: no  
**Required fields**: `content`

#### Props

| Key        | Type               | Description |
|------------|--------------------|-------------|
| `content`  | `string`           | **[required]** The badge text |
| `category` | `BadgeCategory`    | Controls colour lookup (see below) |

#### Valid `category` values

`"docstatus"`, `"job"`, `"payment"`, `"sales"`, `"stock"`, `"project"`,
`"hr"`, `"manufacturing"`, `"generic"`

---

### `os-data-table`

> Configurable data table with declarative column spec.

**Allowed parents**: `grid`, `stack`, `section`  
**Supports children**: no  
**Required fields**: `columns`, `rows`

#### Props

| Key                | Type                    | Default | Description |
|--------------------|-------------------------|---------|-------------|
| `title`            | `string`                | —       | Table heading |
| `subtitle`         | `string`                | —       | Subtitle text |
| `columns`          | `ColumnSpec[]`          | —       | **[required]** Column definitions (see below) |
| `rows`             | (data-bound)            | —       | **[required]** Row data — always via a `data` binding |
| `rowId`            | `string`                | —       | Field name used as the unique row key |
| `currency`         | `string`                | —       | Default currency for `format:"currency"` columns |
| `searchable`       | `boolean`               | `false` | Show a search box |
| `searchPlaceholder`| `string`                | —       | Placeholder text in the search box |
| `searchParam`      | `string`                | —       | URL search param name for server-side search (e.g. `"orders_search"`) |
| `columnVisibility` | `boolean`               | `false` | Show column-visibility toggle |
| `compulsoryColumns`| `string[]`              | —       | Column fields that cannot be hidden |
| `minVisibleColumns`| `number`                | —       | Minimum number of visible columns |
| `selectable`       | `boolean`               | `false` | Show row-selection checkboxes |
| `paginated`        | `boolean`               | `false` | Enable pagination |
| `pageSize`         | `number`                | —       | Rows per page (client-side pagination) |
| `emptyMessage`     | `string`                | —       | Text shown when there are no rows |
| `pageParam`        | `string`                | —       | URL param for server-side page number (e.g. `"orders_page"`) |
| `pageSizeParam`    | `string`                | —       | URL param for per-page size selector (e.g. `"orders_page_size"`) |
| `sortParam`        | `string`                | —       | URL param for server-side sort (e.g. `"orders_sort"`) |
| `pagination`       | (data-bound)            | —       | Bound to `{ ref, path: "pagination" }` for server-side pagination |

#### `ColumnSpec`

| Key             | Type                                                              | Required? | Description |
|-----------------|-------------------------------------------------------------------|-----------|-------------|
| `field`         | `string`                                                          | yes       | Field name in each row object |
| `label`         | `string`                                                          | yes       | Column header text |
| `format`        | `"text" \| "number" \| "currency" \| "date" \| "badge"`          | no        | How to render the value |
| `align`         | `"left" \| "right" \| "center"`                                  | no        | Cell alignment |
| `sortable`      | `boolean`                                                         | no        | Show sort toggle on this column |
| `filterable`    | `boolean`                                                         | no        | Show a column-level filter |
| `filterOptions` | `string[]`                                                        | no        | Fixed option list for the filter dropdown |
| `filterParam`   | `string`                                                          | no        | URL param for server-driven column filter (e.g. `"orders_filter_status"`) |
| `badgeCategory` | `BadgeCategory`                                                   | no        | Category for `format:"badge"` colour lookup |
| `width`         | `number`                                                          | no        | Column width in pixels |

#### Server-side pagination pattern

```jsonc
// In definition.data:
"recentOrders": {
  "request": {
    "type": "frappe", "operation": "list", "doctype": "Sales Order",
    "params": { "fields": ["name","customer","grand_total","status","transaction_date"],
                "orderBy": "transaction_date desc", "pageSize": 10 }
  },
  "query": {
    "pagination": { "pageSize": 10 },
    "sort": { "allowedFields": ["transaction_date","grand_total","name","customer"] },
    "search": { "fields": ["name","customer"] },
    "filters": [{ "field": "status", "operator": "=" }]
  }
}

// In the component node:
{
  "id": "orders-table",
  "kind": "component",
  "type": "os-data-table",
  "props": {
    "pageParam": "recentOrders_page",
    "pageSizeParam": "recentOrders_page_size",
    "sortParam": "recentOrders_sort",
    "searchable": true,
    "searchParam": "recentOrders_search",
    "columns": [
      { "field": "status", "label": "Status", "format": "badge", "badgeCategory": "sales",
        "filterable": true, "filterParam": "recentOrders_filter_status",
        "filterOptions": ["Draft","To Bill","Completed","Cancelled"] }
    ]
  },
  "data": {
    "rows": { "ref": "recentOrders", "path": "rows" },
    "pagination": { "ref": "recentOrders", "path": "pagination" }
  }
}
```

---

### `os-chart`

> A composed chart (bar/line/area series) over a shared x-axis.

**Allowed parents**: `grid`, `stack`, `section`  
**Supports children**: no  
**Required fields**: `x`, `series`, `rows`

#### Props

| Key        | Type            | Description |
|------------|-----------------|-------------|
| `title`    | `string`        | Chart heading |
| `subtitle` | `string`        | Chart subtitle |
| `x`        | `string`        | **[required]** Field name to use as the x-axis key (e.g. `"key"` for grouped date data) |
| `series`   | `SeriesSpec[]`  | **[required]** Which fields to draw as series |
| `legend`   | `boolean`       | Show legend |
| `height`   | `number`        | Chart height in pixels |
| `rows`     | (data-bound)    | **[required]** Row data — always via `data` binding |

#### `SeriesSpec`

| Key     | Type                             | Required? | Description |
|---------|----------------------------------|-----------|-------------|
| `field` | `string`                         | yes       | Field in each row that provides the y-value |
| `label` | `string`                         | yes       | Series display name in the legend |
| `type`  | `"bar" \| "line" \| "area"`      | yes       | Chart type for this series |
| `color` | `string`                         | no        | Override colour (CSS colour string) |

---

### `os-filter-bar`

> One or more filter controls (select / text / date-range), each bound to its own URL search param.

**Allowed parents**: `grid`, `stack`, `section`, `inline`  
**Supports children**: no  
**Required fields**: `filters`

#### Props

| Key              | Type                | Description |
|------------------|---------------------|-------------|
| `filters`        | `FilterFieldConfig[]`| **[required]** Filter control definitions |
| `resetPageParams`| `string[]`          | URL params to clear alongside any filter change (e.g. pagination page params like `"orders_page"`) |

#### `FilterFieldConfig`

| Key            | Type                                      | Required? | Description |
|----------------|-------------------------------------------|-----------|-------------|
| `id`           | `string`                                  | yes       | Unique identifier for this filter |
| `type`         | `"select" \| "text" \| "date-range"`      | yes       | Control type |
| `label`        | `string`                                  | yes       | Visible label |
| `searchParam`  | `string`                                  | yes       | URL search param name this filter reads/writes |
| `options`      | `string[]`                                | no        | Option list for `type:"select"` |
| `defaultValue` | `string`                                  | no        | Default value when param is absent |
| `placeholder`  | `string`                                  | no        | Input placeholder text |

---

### `os-period-toggle`

> Period selector driven by the page's global `?period=` URL param.

**Allowed parents**: `grid`, `stack`, `section`, `inline`  
**Supports children**: no  
**Required fields**: none

#### Props

| Key             | Type                                        | Default   | Description |
|-----------------|---------------------------------------------|-----------|-------------|
| `paramName`     | `string`                                    | `"period"`| URL param name to read/write |
| `defaultPeriod` | `"1D" \| "1W" \| "1M" \| "1Y"`             | `"1M"`    | Period shown when param is absent |

---

## 6. Data Layer

### Named Page-Level Data Definitions

Declare reusable, URL-addressable data sources once in `definition.data`:

```ts
type UIPageDefinition = {
  data?: Record<string, DataDefinition>;
  // ...
};

type DataDefinition = {
  request: DataRequest;           // what to fetch (see below)
  query?: QueryBinding;           // which parts of the request are URL-driven
  transform?: TransformStep[];    // how to reshape the raw response
};
```

A named entry is referenced from any component's `data` map via
`{ ref: "<name>", path? }`.

---

### DataRequest — three operation types

All requests have `type: "frappe"` (the only backend).

#### `operation: "list"` — fetch rows from a Frappe doctype

```jsonc
{
  "type": "frappe",
  "operation": "list",
  "doctype": "Sales Order",
  "params": {
    "fields": ["name", "customer", "grand_total", "status", "transaction_date"],
    "filters": [
      { "field": "docstatus", "operator": "=", "value": 1 },
      { "field": "transaction_date", "operator": ">=", "value": "$period_start" }
    ],
    "orderBy": "transaction_date desc",
    "pageSize": 100,
    "page": 1
  }
}
```

| Param      | Type                | Required | Notes |
|------------|---------------------|----------|-------|
| `fields`   | `string[]`          | yes      | Frappe field names; `"name"` is always injected even if omitted |
| `filters`  | `FrappeFilter[]`    | no       | Static, always-applied filters |
| `orderBy`  | `string`            | no       | Pattern: `"fieldname asc\|desc"` (comma-separate for multiple) |
| `pageSize` | `number` (1–1000)   | yes      | Fetch cap; real UI pagination requires `query.pagination` too |
| `page`     | `number`            | no       | Rarely set statically; the resolver reads it from the URL via `query` |

#### `operation: "count"` — count matching rows

```jsonc
{
  "type": "frappe",
  "operation": "count",
  "doctype": "Customer",
  "params": {
    "filters": [{ "field": "disabled", "operator": "=", "value": 0 }]
  }
}
```

Resolves to a plain `number`. `params` is optional.

#### `operation: "method"` — call a whitelisted Frappe API method

```jsonc
{
  "type": "frappe",
  "operation": "method",
  "method": "alaiy_os.api.dashboard_stats.get_dashboard_overview",
  "args": { "period": "$period", "channel": null }
}
```

| Param    | Type                                    | Notes |
|----------|-----------------------------------------|-------|
| `method` | `string`                                | A whitelisted Python method path |
| `args`   | `Record<string, string\|number\|boolean\|null>` | Optional method arguments; sentinels like `"$period"` are substituted (see §8) |

---

### FrappeFilter

```ts
type FrappeFilter = {
  field: string;
  operator: FrappeFilterOperator;
  value: string | number | (string | number)[];
};
```

**`FrappeFilterOperator`** values:
`"="`, `"!="`, `"like"`, `"not like"`, `">"`, `"<"`, `">="`, `"<="`, `"in"`, `"not in"`

- `"in"` / `"not in"` **require** an array value.
- All other operators require a scalar value.
- For `like`/`not like` in static `filters`, write the literal Frappe string you want (wildcards included, e.g. `"%foo%"`) — the runtime does **not** auto-wrap static filter values.

---

### QueryBinding — URL-driven request state

Only valid for `operation: "list"`. Declares which parts of the request a
user can control through the URL.

```ts
type QueryBinding = {
  pagination?: { pageSize: number };
  sort?: { allowedFields: string[] };
  search?: { fields: string[] };
  filters?: { field: string; operator: FrappeFilterOperator }[];
};
```

URL param naming convention — all namespaced by the `definition.data` entry name:

| Feature    | URL param pattern               | Example |
|------------|---------------------------------|---------|
| Page       | `${name}_page`                  | `orders_page` |
| Page size  | `${name}_page_size`             | `orders_page_size` |
| Sort       | `${name}_sort`                  | `orders_sort` |
| Search     | `${name}_search`                | `orders_search` |
| Filter     | `${name}_filter_${field}`       | `orders_filter_status` |

**Rules:**
- A field cannot appear in both `request.params.filters` (static) and `query.filters` (dynamic). A conflict always produces an empty result.
- `query.filters[].operator` supports only the scalar operators (`=`, `!=`, `like`, `not like`, `>`, `<`, `>=`, `<=`). `in`/`not in` are not supported for query-driven filters.
- Search uses `or_filters` under the hood: a live search term is auto-wrapped in `%...%` and matched with `like` against each declared field.

---

### TransformStep — pipeline steps

Transform steps run in order on the resolved data. Steps that operate on
rows (`select`, `filter`, `sort`, `limit`) must come before aggregate steps
that **replace** rows (`group`). Aggregate steps (`count`, `sum`, `avg`,
`min`, `max`) **add new keys** to the result without consuming the row array.

```ts
type TransformStep =
  | { type: "select"; fields: string[] }
  | { type: "filter"; field: string; operator: FrappeFilterOperator; value: string | number | (string|number)[] }
  | { type: "sort"; field: string; direction: "asc" | "desc" }
  | { type: "limit"; count: number }
  | { type: "count"; as: string }
  | { type: "sum"; field: string; as: string }
  | { type: "avg"; field: string; as: string }
  | { type: "min"; field: string; as: string }
  | { type: "max"; field: string; as: string }
  | { type: "group"; by: string; granularity?: "day"|"month"|"year";
      aggregate: { type: "sum"|"count"|"avg"|"min"|"max"; field?: string; as: string } }
  | { type: "formula"; expression: string; as: string }
```

#### Step reference

| Step       | What it does |
|------------|--------------|
| `select`   | Keep only the listed fields in each row |
| `filter`   | Remove rows that don't match the predicate |
| `sort`     | Sort rows by `field` in `direction` order |
| `limit`    | Keep only the first `count` rows |
| `count`    | Adds `{ [as]: <rowCount> }` to the result (rows unchanged) |
| `sum`      | Adds `{ [as]: <sum of field> }` to the result |
| `avg`      | Adds `{ [as]: <average of field> }` to the result |
| `min`      | Adds `{ [as]: <min of field> }` to the result |
| `max`      | Adds `{ [as]: <max of field> }` to the result |
| `group`    | Replaces rows with one summary row per group value; `granularity` truncates a date field before grouping |
| `formula`  | Computes a new value from prior `as`-named results; writes `{ [as]: <result> }`. Expression characters: `0-9 a-z A-Z _ . + - * / ( ) space` only. Max 200 chars. |

**`group` output**: each output row has `{ key: <group value>, [aggregate.as]: <aggregate value> }`.  
Use `{ type: "sort", field: "key", direction: "asc" }` after a `group` to order by date.

**`formula` example** — compute AOV:
```jsonc
{ "type": "sum",     "field": "grand_total", "as": "revenue" },
{ "type": "count",   "as": "orders" },
{ "type": "formula", "expression": "revenue / orders", "as": "aov" }
```

---

### DataSourceRef — binding a data definition to a prop

A component's `data` map maps **prop names** to sources:

```ts
// Shape 1: named page-level data entry
{ ref: "myDataName", path?: "rows" | "pagination" | "<any dot-path>" }

// Shape 2: registered (domain-specific) source by id
{ source: "dashboard.greeting", path?: "greeting" }
```

The `path`, when set, reaches one field out of the resolved value using
dot-notation (`"rows"`, `"pagination"`, `"total_sales.current"`). Omitted,
the whole resolved value is passed as the prop.

**Resolved shapes for `operation: "list"` with `query.pagination`:**
```ts
// What `{ ref: "name" }` resolves to:
{
  rows: Row[];
  pagination: { page: number; pageSize: number; hasMore: boolean };
}
// So use path: "rows" for the table and path: "pagination" for the pagination prop.
```

**Resolved shape for `operation: "count"`**: a plain `number`.

**Resolved shape for `operation: "method"`**: whatever the Python method returns — document that method's output separately.

**Resolved shape after transforms**: the transform result is a plain object.
Use the `as` keys from aggregate/formula steps as `path` values.

---

### Registered (Domain-Specific) Sources

Some sources are pre-registered in the Data Source Registry and addressed by
their string `id` using `{ source: "..." }`:

| Source id               | Returns |
|-------------------------|---------|
| `dashboard.greeting`    | `{ greeting: string; formattedDate: string }` |

> Any other domain-specific source must be registered in code via
> `registerDataSource()` before being referenced. If the source id is
> unknown the validator will report an error.

---

## 7. Responsive Layout Values

`ResponsiveValue` is used both for grid `columns` and node `layout.span`:

```ts
type Breakpoint = "base" | "sm" | "md" | "lg" | "xl";
type ResponsiveValue = Partial<Record<Breakpoint, number>>;
```

Only the values in the static lookup tables render correctly (Tailwind
build-time scanner requirement):

**Grid `columns`** (on a `type:"grid"` layout node):
- `base: 1`
- `md: 2` or `md: 3`
- `xl: 4` or `xl: 12`

**Node `layout.span`** (on any node inside a grid):
- `xl: 5`, `xl: 6`, `xl: 7`, or `xl: 12`

An out-of-range value is a registry validation error.

---

## 8. Sentinel Substitution

Two string sentinels may appear as `value` in `FrappeFilter.value` (for
`operation: "list"`) or as `args` values (for `operation: "method"`):

| Sentinel          | Substituted with |
|-------------------|-----------------|
| `"$period"`       | The current period string: `"1D"`, `"1W"`, `"1M"`, or `"1Y"` (read from `?period=` URL param; defaults to `"1M"`) |
| `"$period_start"` | An ISO date string (`YYYY-MM-DD`) representing the start of the selected period relative to today |

These are the **only** two sentinels. No other `$`-prefixed strings are substituted.

---

## 9. Validation Rules & Gotchas

### IDs must be globally unique

Every `id` across the entire tree — `PageConfigFile.id`,
`UIPageDefinition.id`, and every `LayoutNode.id` / `ComponentNode.id` —
must be unique within the document. Duplicate ids are a hard validation error.

### Every node must have `kind`

`kind` is always `"layout"` or `"component"`. Omitting it causes zod
validation to fail with an unresolvable discriminated union error.

### `allowedParents` — placement constraints

| Component          | Allowed parents |
|--------------------|----------------|
| `os-page-header`   | `stack`, `section` only |
| `os-card`          | `grid`, `stack`, `section`, `inline` |
| `os-kpi`           | `grid`, `stack`, `section` |
| `os-dynamic-badge` | `grid`, `stack`, `section`, `inline` |
| `os-data-table`    | `grid`, `stack`, `section` |
| `os-chart`         | `grid`, `stack`, `section` |
| `os-filter-bar`    | `grid`, `stack`, `section`, `inline` |
| `os-period-toggle` | `grid`, `stack`, `section`, `inline` |

Placing a component under an illegal parent type is a registry validation
error.

### `columns` / `span` must use supported values

A `columns` or `span` value with no matching Tailwind class is a registry
validation error. Stick to the tables in §7.

### `query` only works with `operation: "list"`

A `DataDefinition` with `query` set but `request.operation !== "list"` is a
validation error.

### A field cannot be in both `request.params.filters` and `query.filters`

Declaring the same field in static filters and dynamic query filters is a
validation error.

### `propsSchema` is `.strict()`

Every registered component's props schema is strict — an unrecognised prop
key (a typo, a prop the component doesn't read) is a validation error, not
silently ignored.

### `requiredFields` checked against `props ∪ data` keys

A required field satisfied through a `data` binding does **not** need to
appear in `props`. Either one satisfies the requirement.

### `rows` is always data-bound, never a literal prop

`os-data-table.rows` and `os-chart.rows` are never set as literal `props`
values — they come from Frappe (or a transform result) at render time and
must be declared in `data`.

### `os-filter-bar`'s `resetPageParams`

When a page has both filter bars and paginated tables, add the table's
`pageParam` (and `pageSizeParam`) to the filter bar's `resetPageParams` list.
Otherwise, a filter change leaves the user on a page number that may no
longer match the new result set.

### Period toggle vs filter-bar period select

Both work, but they're distinct:
- `os-period-toggle` is a dedicated period UI widget; it always writes `?period=`.
- `os-filter-bar` can include a period control as a `FilterFieldConfig` with `searchParam: "period"`.
Do not use both for the same param on the same page.

### Data source `ref` requires a matching `data` key

`{ ref: "customers" }` only works if `definition.data` has a `"customers"`
key. Missing entries are caught by registry validation.

### `orderBy` format

Must match `"fieldname asc|desc"` (case-insensitive). Multiple fields:
`"transaction_date desc, grand_total asc"`. Field names must be word
characters only.

### `formula` expression grammar

Only `0-9 a-z A-Z _ . + - * / ( ) space`. Max 200 characters. No string
literals, conditionals, or external functions. References to undefined
names produce `NaN`. Division by zero produces `Infinity`.

### `os-page-header` goes first, inside a `stack`

The page header is rendered once, at the top of the page. Place it as the
first child inside the root `stack` (or `section`). Its children land in
the action slot (right side of the header row) — always wrap them in an
`inline` layout node.

---

## 10. Full Example — Dashboard Page

This is the real production dashboard (`/os`), reproduced here as a complete
annotated reference:

```jsonc
{
  "id": "dashboard",
  "route": "/os",
  "metadata": {
    "title": "Dashboard",
    "description": "The /os dashboard."
  },
  "definition": {
    "id": "headless-dashboard",
    "kind": "page",

    // Named data entries — resolved once, referenced by components via { ref: "..." }
    "data": {

      // Method call — complex business logic stays server-side
      "overview": {
        "request": {
          "type": "frappe",
          "operation": "method",
          "method": "alaiy_os.api.dashboard_stats.get_dashboard_overview",
          "args": { "period": "$period", "channel": null }
        }
      },

      "topProducts": {
        "request": {
          "type": "frappe",
          "operation": "method",
          "method": "alaiy_os.api.dashboard_stats.get_top_products",
          "args": { "period": "$period", "channel": null }
        }
      },

      "stockMix": {
        "request": {
          "type": "frappe",
          "operation": "method",
          "method": "alaiy_os.api.item_stats.get_stock_mix"
        }
      },

      // List + transform — AOV computed client-side from raw rows
      "aov": {
        "request": {
          "type": "frappe",
          "operation": "list",
          "doctype": "Sales Order",
          "params": {
            "fields": ["grand_total"],
            "filters": [
              { "field": "docstatus", "operator": "=", "value": 1 },
              { "field": "transaction_date", "operator": ">=", "value": "$period_start" }
            ],
            "pageSize": 1000
          }
        },
        "transform": [
          { "type": "sum",     "field": "grand_total", "as": "revenue" },
          { "type": "count",   "as": "orders" },
          { "type": "formula", "expression": "revenue / orders", "as": "aov" }
        ]
      },

      // List + group transform — monthly revenue for chart
      "salesByMonth": {
        "request": {
          "type": "frappe",
          "operation": "list",
          "doctype": "Sales Order",
          "params": {
            "fields": ["transaction_date", "grand_total"],
            "filters": [{ "field": "docstatus", "operator": "=", "value": 1 }],
            "pageSize": 1000
          }
        },
        "transform": [
          {
            "type": "group",
            "by": "transaction_date",
            "granularity": "month",
            "aggregate": { "type": "sum", "field": "grand_total", "as": "revenue" }
          },
          { "type": "sort",  "field": "key", "direction": "asc" },
          { "type": "limit", "count": 12 }
        ]
      },

      // List with full URL-driven query state (search, filter, sort, pagination)
      "recentOrders": {
        "request": {
          "type": "frappe",
          "operation": "list",
          "doctype": "Sales Order",
          "params": {
            "fields": ["name","customer","grand_total","status","transaction_date"],
            "orderBy": "transaction_date desc",
            "pageSize": 10
          }
        },
        "query": {
          "pagination": { "pageSize": 10 },
          "sort": { "allowedFields": ["transaction_date","grand_total","name","customer"] },
          "search": { "fields": ["name","customer"] },
          "filters": [{ "field": "status", "operator": "=" }]
        }
      }
    },

    "children": [
      {
        // Root: vertical stack
        "id": "root-stack",
        "kind": "layout",
        "type": "stack",
        "children": [

          // Page header with inline action slot
          {
            "id": "page-header",
            "kind": "component",
            "type": "os-page-header",
            "data": {
              "title":    { "source": "dashboard.greeting", "path": "greeting" },
              "subtitle": { "source": "dashboard.greeting", "path": "formattedDate" }
            },
            "children": [
              {
                "id": "header-actions",
                "kind": "layout",
                "type": "inline",
                "children": [
                  {
                    "id": "filter-bar",
                    "kind": "component",
                    "type": "os-filter-bar",
                    "props": {
                      "filters": [
                        {
                          "id": "period",
                          "type": "select",
                          "label": "Period",
                          "searchParam": "period",
                          "options": ["1D","1W","1M","1Y"],
                          "defaultValue": "1M"
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          },

          // KPI + Chart in a 12-column grid
          {
            "id": "kpi-chart-row",
            "kind": "layout",
            "type": "grid",
            "columns": { "base": 1, "xl": 12 },
            "children": [

              // Left: 2-column KPI grid, spans 5 of 12 at xl
              {
                "id": "kpi-grid",
                "kind": "layout",
                "type": "grid",
                "columns": { "base": 1, "md": 2 },
                "layout": { "span": { "xl": 5 } },
                "children": [
                  {
                    "id": "kpi-total-sales",
                    "kind": "component",
                    "type": "os-kpi",
                    "props": { "title": "Total Sales", "icon": "DollarSign", "format": "currency" },
                    "data": { "value": { "ref": "overview", "path": "total_sales.current" } }
                  },
                  {
                    "id": "kpi-total-orders",
                    "kind": "component",
                    "type": "os-kpi",
                    "props": { "title": "Total Orders", "icon": "ShoppingBag", "format": "number" },
                    "data": { "value": { "ref": "overview", "path": "total_orders.current" } }
                  },
                  {
                    "id": "kpi-customer-growth",
                    "kind": "component",
                    "type": "os-kpi",
                    "props": { "title": "Customer Growth", "icon": "Users", "format": "number" },
                    "data": { "value": { "ref": "overview", "path": "customer_growth.current" } }
                  },
                  {
                    "id": "kpi-average-order",
                    "kind": "component",
                    "type": "os-kpi",
                    "props": { "title": "Average Order", "icon": "ReceiptText", "format": "currency" },
                    "data": { "value": { "ref": "aov", "path": "aov" } }
                  }
                ]
              },

              // Right: Sales chart, spans 7 of 12 at xl
              {
                "id": "sales-overview-chart",
                "kind": "component",
                "type": "os-chart",
                "layout": { "span": { "xl": 7 } },
                "props": {
                  "title": "Sales Overview",
                  "x": "key",
                  "legend": true,
                  "series": [{ "field": "revenue", "label": "Revenue", "type": "area" }]
                },
                "data": { "rows": { "ref": "salesByMonth", "path": "rows" } }
              }
            ]
          },

          // Recent orders — full-width, server-paginated table
          {
            "id": "recent-orders-table",
            "kind": "component",
            "type": "os-data-table",
            "props": {
              "title": "Recent Orders",
              "rowId": "name",
              "pageParam": "orders_page",
              "pageSizeParam": "orders_page_size",
              "sortParam": "orders_sort",
              "searchable": true,
              "searchParam": "orders_search",
              "columnVisibility": true,
              "emptyMessage": "No orders found.",
              "columns": [
                { "field": "name",             "label": "Order" },
                { "field": "customer",         "label": "Customer" },
                {
                  "field": "status", "label": "Status",
                  "format": "badge", "badgeCategory": "sales",
                  "filterable": true,
                  "filterParam": "orders_filter_status",
                  "filterOptions": ["Draft","To Deliver and Bill","To Bill","To Deliver","Completed","Cancelled","Closed","On Hold"]
                },
                { "field": "transaction_date", "label": "Date",  "format": "date",     "sortable": true },
                { "field": "grand_total",      "label": "Total", "format": "currency", "align": "right", "sortable": true }
              ]
            },
            "data": {
              "rows":       { "ref": "recentOrders", "path": "rows" },
              "pagination": { "ref": "recentOrders", "path": "pagination" }
            }
          }

        ]
      }
    ]
  }
}
```

---

## Quick Reference Cheatsheet

```
PageConfigFile
├── id          (unique page key)
├── route       (starts with "/")
├── metadata?   (title, description)
└── definition  ← UIPageDefinition
    ├── id      (distinct from PageConfigFile.id)
    ├── kind    "page"
    ├── data?   Record<name, DataDefinition>
    │   └── DataDefinition
    │       ├── request   FrappeListRequest | FrappeCountRequest | FrappeMethodRequest
    │       ├── query?    QueryBinding  (list only)
    │       └── transform? TransformStep[]
    └── children  UINode[]
        ├── LayoutNode   { id, kind:"layout",    type: stack|section|inline|grid, columns?, layout?, children }
        └── ComponentNode { id, kind:"component", type: os-*, layout?, props?, data?, children? }
                                                                  ↑
                              data: { propName: { ref:"name", path? } | { source:"id", path? } }
```

### Component quick summary

| Type               | Required fields        | Takes children? | Typical placement |
|--------------------|------------------------|-----------------|-------------------|
| `os-page-header`   | `title`                | yes (action slot)| First child of root stack |
| `os-card`          | —                      | yes             | grid / stack      |
| `os-kpi`           | `title`, `value`       | no              | grid              |
| `os-dynamic-badge` | `content`             | no              | inline / stack    |
| `os-data-table`    | `columns`, `rows`      | no              | stack / grid      |
| `os-chart`         | `x`, `series`, `rows`  | no              | grid              |
| `os-filter-bar`    | `filters`              | no              | inline            |
| `os-period-toggle` | —                      | no              | inline            |

### Data binding patterns

```jsonc
// Static prop
"props": { "title": "My Page" }

// Bound from a named data entry (the common pattern)
"data": { "value": { "ref": "overview", "path": "total_sales.current" } }

// Bound from a registered domain source
"data": { "title": { "source": "dashboard.greeting", "path": "greeting" } }

// Pagination: two bindings, one resolution
"data": {
  "rows":       { "ref": "recentOrders", "path": "rows" },
  "pagination": { "ref": "recentOrders", "path": "pagination" }
}
```
