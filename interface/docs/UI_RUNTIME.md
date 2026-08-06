# UI Runtime (Headless OS)

This is the architecture that will eventually let Ask Alaiy modify Alaiy OS
pages directly:

```
Ask Alaiy
    │
    ▼
Structured UI Actions
    │
    ▼
UI Definition (SQLite)
    │
    ├── Layout Registry
    ├── Component Registry
    └── Data Source Registry
    │
    ▼
UI Renderer
    │
    ▼
Existing React UI (Alaiy OS components)
    │
    ▼
Existing BaaS / data layer (Frappe)
```

**Ask Alaiy is not integrated yet.** What exists today is everything below
"Structured UI Actions": a typed UI Definition stored in a local SQLite
database, a Layout Registry, a Component Registry, a Data Source Registry,
a UI Renderer, and a mutation vocabulary (`applyUIAction`) that already has
the right shape for an LLM to eventually produce - but nothing here calls an
LLM, and nothing writes back to the database yet.

Two real pages prove it: `/os` (the dashboard) and `/os/customers` - real
Frappe data, composed from a UI Definition instead of hardcoded JSX.
`/os/customers` has no `page.tsx` of its own - it resolves through the one
dynamic route every other `/os/<id>` uses,
`src/app/(platform)/os/[...page]/page.tsx`. The dashboard does have its own
`src/app/(platform)/os/page.tsx`, since bare `/os` has no segments for that
catch-all to match - it's a thin wrapper hardcoding `resolvePage("dashboard", ...)`,
not a second rendering path.

Both pages used to live at `/os/headless` and `/os/headless/customers`, a
test route proving this runtime against a real page before trusting it with
the real dashboard, alongside a separate hardcoded `/os` dashboard. That test
route is gone now - the dashboard and customers pages are the only
production versions, with no parallel test surface (see `obsolete/README.md`).

## Why this exists

Ask Alaiy's UI-modification engine cannot be trusted to emit React/TSX
source and have it executed. It needs a small, closed vocabulary of things
it's allowed to say ("put a KPI here," "remove this component," "move this
table above that chart") and a runtime that turns those statements into real
UI using components that already exist and are already correct - and it
needs a place to write structured page definitions that isn't the Git
repository. This runtime builds that vocabulary, that runtime, and that
storage seam against two real pages, before any AI is wired in.

## The big architectural principle this repo follows

> **Git contains platform capabilities (the runtime, the registries, the
> real React components). The local SQLite database contains page
> configuration (which components, in what layout, bound to which data).**

A related, newer principle: **`runtime/` holds only behavior.** Plain type
declarations, constants, and zod schemas don't live next to the functions
that use them - they live in `src/types/`, `src/config/`, and `src/seeds/`
respectively (see "File map" below). A file under `runtime/` that has no
executable logic in it - just an `interface` or a lookup table - is a sign
something should move out.

## File map

```
src/runtime/                  behavior only - functions, classes, registries holding real components
├── layout.ts                 gridColsClasses/spanClasses/isValidSpanValue/isValidGridColumnsValue
├── mutations.ts               applyUIAction (ADD/REMOVE/MOVE/UPDATE_COMPONENT)
├── node.ts                    isLayoutNode/isComponentNode
├── page-features.tsx          pageFeatures render-override map (empty today)
├── resolve-page.tsx           the one pipeline every route calls
├── ui-renderer.tsx            UIRenderer - the actual tree-walking render
├── registry/                  the two "what can this render as" registries
│   ├── component-registry.ts  baseComponentRegistry, mergeRegistries, resolveComponent,
│   │                          listAiExposedComponents
│   └── layout-registry.ts     layoutRegistry, resolveLayout
├── validate/                  the two validation passes, grouped (see below)
│   ├── validate.ts             validatePageConfig, findDuplicateIds (structural)
│   └── validate-against-registry.ts   registry-aware validation
├── data/
│   ├── registry.ts            Data Source Registry (registerDataSource/getDataSource/listDataSources)
│   ├── resolver.ts             resolvePageData/resolveSource - walks a definition, dispatches each
│   │                           referenced source (registry id or inline config) in parallel
│   ├── resolve-data-source.ts  DataSourceRef resolution (sourceKey, dot-path getter)
│   ├── frappe-list-resolver.ts  createFrappeListSource - generic frappe-list mechanism
│   ├── frappe-count-resolver.ts resolveFrappeCount - generic frappe-count mechanism
│   └── sources/                dashboard.ts, customers.ts, index.ts (registers both as a side effect)
└── store/
    ├── sqlite-page-store.ts        SQLiteUIPageStore (ui_pages table)
    ├── sqlite-sidebar-store.ts     SQLiteSidebarStore (sidebar_groups/sidebar_items tables)
    ├── sqlite-preferences-store.ts  SQLitePreferencesStore (preferences table)
    ├── invalid-page-config-error.ts  InvalidPageConfigError
    ├── auth/auth-provider.tsx        AuthProvider/useAuth (client Zustand-free context)
    ├── company/company-provider.tsx  CompanyProvider/useCompany
    └── preferences/                  PreferencesStoreProvider/usePreferencesStore (Zustand,
                                       client-side state seeded from the DB, see below)

src/types/runtime/            every pure type/interface the runtime uses - zero logic
├── node.ts        LayoutType, ComponentType, NodeLayout, LayoutNode, ComponentNode, UINode
├── page.ts         UIPageDefinition (incl. the optional named `data` dict - see "Paginated Data Sources")
├── page-config.ts   PageConfigFile, ValidationResult
├── page-features.ts PageFeatureBinding
├── actions.ts       UIAction
├── data-source.ts   DataSourceFieldType/Field/Context/Capabilities/Definition
├── data-source-ref.ts  DataSourceRef (source: registry id, or an inline frappe-list/frappe-count config)
├── frappe-list.ts   FrappeListFilterOperator/Filter/Pagination/SourceConfig, FrappeListResult
├── frappe-count.ts  FrappeCountSourceConfig
├── layout.ts        Breakpoint, ResponsiveValue
├── registry.ts      ComponentCapabilities, ComponentRegistryEntry, ComponentRegistry
├── validation.ts    ValidateAgainstRegistryOptions
└── store.ts         UIPageStore, SidebarStore interfaces

src/config/
├── page-schema.ts    the zod schemas validate/validate.ts checks a definition against (structural) -
│                     DATA_SOURCE_REF_SCHEMA's `source` is a union: a registry-id string, or the
│                     frappe-list/frappe-count schemas below (nested in their own discriminated union)
├── component-props-schema.ts  per-type propsSchema zod objects (registry-aware, see below)
├── frappe-list-schema.ts  FRAPPE_LIST_SOURCE_CONFIG_SCHEMA + its filter/pagination sub-schemas
├── frappe-count-schema.ts  FRAPPE_COUNT_SOURCE_CONFIG_SCHEMA (reuses frappe-list's filter schema)
├── layout-classes.ts  GRID_COLS_CLASSES/SPAN_CLASSES Tailwind lookup tables
├── kpi-icons.ts        curated icon-name ↔ LucideIcon map for os-kpi (KPI_ICONS, KPI_ICON_NAMES)
├── kpi-classes.ts      KPI_BORDER_TONES + KPI_BORDER_TONE_CLASSES for os-kpi's accent bar
├── nav-icons.ts        curated icon-name ↔ LucideIcon map for the sidebar
├── contributed-nav.ts  composer-generated connector nav contributions (unchanged contract)
└── contributed-components.ts  composer-generated connector registry entries (the `components`
                               extension point - ships empty, see "Composing registries" below)

src/seeds/
├── pages/seed-data.ts    HEADLESS_DASHBOARD_PAGE, HEADLESS_CUSTOMERS_PAGE, HEADLESS_DATA_TEST_PAGE,
│                         HEADLESS_SUPPLIERS_PAGE, SEED_PAGES
├── sidebar/seed-data.ts  buildCodeDefinedSidebar() - base groups + contributedNav merge
└── seed-headless-db.ts   dev script: deletes the sqlite file to force a reseed

src/tests/runtime/        every runtime test, mirroring the file map above
src/tests/config/         config-level tests (e.g. nav-icons)

src/components/
├── registry/          the actual React components the Component Registry points at:
│                       card.tsx, chart.tsx, filter-bar.tsx, kpi.tsx, page-header.tsx,
│                       period-toggle.tsx, stat-card.tsx, data-table/ (data-table.tsx,
│                       data-table-view.tsx, column-spec.tsx, apply-filters.ts,
│                       use-pagination-param.ts, use-sort-param.ts)
└── layout/             coming-soon.tsx, invalid-page-config.tsx (the two render fallbacks),
                        sidebar/ (app-sidebar.tsx, settings-sidebar.tsx), nav-main.tsx
```

Why this split, concretely: `runtime/registry/component-registry.ts` imports
real React components from `@/components/registry/*` and assembles
`baseComponentRegistry` - that assembly, and `resolveComponent`, are logic,
so they stay in `runtime/`. The *shape* of a registry entry
(`ComponentRegistryEntry`) is a pure type with no behavior, so it lives in
`types/runtime/registry.ts` instead of being declared inline. `registry/`
groups it with `layout-registry.ts` (both answer "what can this render as");
`validate/` groups the structural and registry-aware validation passes the
same way - two files each, a real pairing rather than a folder for its own
sake. Same pattern throughout: `runtime/layout.ts`'s functions stay, the Tailwind class tables
they read from moved to `config/layout-classes.ts`; `runtime/validate/validate.ts`'s
functions stay, the zod schemas they call moved to `config/page-schema.ts`.

## The Page Store: SQLite, not bundled JSON

`interface/public/headless-os.sqlite` - one table:

```sql
CREATE TABLE ui_pages (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL UNIQUE,
  title TEXT,
  definition_json TEXT NOT NULL,
  metadata_json TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Accessed only through `UIPageStore` (`types/runtime/store.ts`):

```ts
interface UIPageStore {
  getPageByRoute(route: string): Promise<PageConfigFile | null>;
  getPageById(id: string): Promise<PageConfigFile | null>;
  listPages(): Promise<PageConfigFile[]>;
}
```

`SQLiteUIPageStore` (`runtime/store/sqlite-page-store.ts`) is the only
implementation today, built on Node's built-in `node:sqlite` (`DatabaseSync`)
- zero new dependencies, no native binary to trace into a `standalone`
build. **This is still an experimental Node API** (stable without a flag on
this repo's Node version, 22.21.0, but Node's own docs reserve the right to
change it) - that risk is isolated to this one file by the `UIPageStore`
interface. A future `FrappePageStore` implements the same three methods
against a Frappe-backed table; nothing above the interface (the dynamic
route, `resolve-page.tsx`, the renderer, the registries) changes either way
(see "Planned: Frappe-backed persistence" below).

**Security**: `public/` is normally served as static files by Next.js
regardless of auth state - `src/proxy.ts` blocks the one path that matters
(`/headless-os.sqlite`) with a bare 404, checked before anything else, so the
database is never downloadable. The path is resolved server-side via
`path.join(process.cwd(), "public", "headless-os.sqlite")` - never derived
from a request. The file itself is gitignored (`public/*.sqlite*`) and
auto-seeded on first access (`ensureSeeded`) - a fresh clone works with just
`npm run dev`; `npm run seed:headless-db` forces an explicit reseed during
development.

## The Sidebar Store: the `/os/*` sidebar is database-driven too

Same file, two more tables:

```sql
CREATE TABLE sidebar_groups (
  id TEXT PRIMARY KEY, label TEXT, sort_order INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('code','dynamic')), updated_at TEXT NOT NULL
);
CREATE TABLE sidebar_items (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES sidebar_groups(id),
  parent_item_id TEXT REFERENCES sidebar_items(id), title TEXT NOT NULL, url TEXT, icon TEXT,
  badge TEXT CHECK (badge IN ('new','soon')), disabled INTEGER NOT NULL DEFAULT 0,
  new_tab INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL, page_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('code','dynamic')), updated_at TEXT NOT NULL
);
```

Accessed only through `SidebarStore` (`types/runtime/store.ts`, two methods:
`getSidebarNav()` and `ensureDynamicPageEntry()`), implemented by
`SQLiteSidebarStore` (`runtime/store/sqlite-sidebar-store.ts`) - same shape
as `UIPageStore`/`SQLiteUIPageStore`, singleton getter included.

**Unlike `ui_pages`'s seed-once `ensureSeeded`**, `source = 'code'` rows are
deleted and reinserted on *every* store construction
(`syncCodeDefinedSidebar`), from `seeds/sidebar/seed-data.ts`'s
`buildCodeDefinedSidebar()` - the base's own baseline groups (just "OS" and
an unlabeled group holding "Settings" today - see below) and connector
contributions (`config/contributed-nav.ts`, unchanged - see
`docs/CONNECTOR_TO_BASE_UI_COMPOSITION.md` §16) are still code-owned config,
and a redeploy that changes either must take effect without a manual reseed
step. `source = 'dynamic'` rows are never touched by that sync.

**Dynamic entries: a page gets a sidebar entry automatically.**
`SidebarStore.ensureDynamicPageEntry({ pageId, title, url, icon? })` -
idempotent by `pageId` - creates a `source: 'dynamic'` row under an
"Uncategorised" group (created on first use), optionally pointing `page_id`
back at the `ui_pages` row it belongs to. `runtime/store/create-page.ts`'s
`createPageWithSidebarEntry(page, options?)` is the primitive that calls
both `UIPageStore.createPage()` and this together, so a page is never left
unreachable from the sidebar - the seam a future Ask-Alaiy-driven
page-creation flow calls, not built yet, but this is what it calls into.
The two current real pages (`dashboard`, `customers`) got their entries
this same way, from `sqlite-page-store.ts`'s `ensureSeeded` - see their
`layout-dashboard`/`users` icons there for the two cases where a real,
specific icon is known; a page created without one falls back to a
neutral `file-text` placeholder (no AI exists yet to pick something
genuinely relevant).

**Connectors get a fixed home too.** A connector's contributed nav items
land under a `"Connectors"` group by convention (see
`docs/CONNECTOR_TO_BASE_UI_COMPOSITION.md` §16) - one parent item per
connector, its pages as `subItems`, falling back to a `"plug"` icon when
the connector didn't declare one (matching `settings/connectors`'s own
fallback for a connector card).

**Icons cross the Server → Client boundary as plain strings, not components.**
`getSidebarNav()` returns lower-kebab-case icon *names* (the same convention
`interface.config.json`'s `nav` blocks already use), because a `LucideIcon`
component reference can't be passed as a prop from the Server Component that
reads the database (`os/layout.tsx`) to the Client Components that render it
(`AppSidebar`, `SearchDialog`) - the same reasoning as `os-chart`/`os-data-table`
taking declarative specs, not components, below. `config/nav-icons.ts`
resolves a name to its component *inside* those client components, off a
curated `Record<string, LucideIcon>` (not a wildcard `import * as` - that
would ship lucide-react's entire ~4000-icon set into the client bundle,
exactly the tradeoff `config/kpi-icons.ts`'s own `KPI_ICONS` map already
avoids) and its reverse, used only when serializing a contributed item's
still-real-component icon into the database.

Settings' sidebar (`components/layout/sidebar/settings-sidebar.tsx`) is
deliberately **not** part of any of this - a fixed 7-item list in code, since
it's a baseline UI layout thing, not user/site configuration.

## The Preferences Store: theme/layout preferences are database-driven too

Same file, one more table:

```sql
CREATE TABLE preferences (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

Accessed only through `PreferencesStore` (`types/runtime/store.ts`:
`getPreferences()`/`setPreference()`), implemented by
`SQLitePreferencesStore` (`runtime/store/sqlite-preferences-store.ts`) - same
shape as `UIPageStore`/`SidebarStore`, singleton getter included. No seed
step (unlike the sidebar's `source = 'code'` rows): an empty table is the
normal starting state, and a missing key just falls back to
`PREFERENCE_DEFAULTS` at `parsePreference` (`lib/preferences/preferences-config.ts`).

**One shared row per key, not per user or per browser** - a deliberate
choice for this deployment, not a limitation: every signed-in user of a
given deployment sees and changes the same theme/layout preferences, the
same way `sidebar_groups`' `source = 'code'` rows are one shared
configuration rather than per-user. A future per-user store would key by
the Frappe user id `getServerUser()` already resolves, without changing the
`PreferencesStore` interface itself.

**Cookies/localStorage don't go away - they become a client-side cache, not
the source of truth.** `ThemeBootScript` (`scripts/theme-boot.tsx`) runs
pre-hydration, directly reading `document.cookie`/`localStorage`
synchronously to set `data-*` attributes before first paint - a DB round
trip can't happen at that point, so something synchronous and client-local
still has to. `lib/preferences/preferences-storage.ts`'s `persistPreference`
now does both on every write: sets the cookie/localStorage value it always
did (`persistence: "client-cookie" | "server-cookie" | "localStorage"`), and
calls the new `setPreferenceValue` Server Action to write the same value
into `SQLitePreferencesStore` - the durable copy. `"none"`-persistence keys
skip both, unchanged. Server-side reads (`getPreference`/`getAllPreferences`
in `server/server-actions.ts`, used by `RootLayout` and `os/layout.tsx`) now
read the DB, not a cookie - `RootLayout` in particular renders the real
saved preferences into `<html>`'s initial `data-*` attributes instead of
always seeding hardcoded defaults, which is new: previously every request
rendered `PREFERENCE_DEFAULTS` and let the boot script correct it
client-side, whether or not that matched what was saved.

## The Data Source Registry

The abstraction boundary between a UI Definition's `data` bindings and the
existing Frappe BFF (`src/lib/frappe/`). A `data` binding's `source` is one
of two things - a **named** id resolved through the registry below (this
section), or an **inline declarative config** resolved by `type` instead
(`frappe-list`/`frappe-count` - see "Generic Frappe Data Sources" further
down):

```
UI Definition's `data` binding (e.g. { source: "customers" })
        │
        ▼
Data Source Registry (runtime/data/registry.ts) - a plain id -> definition map
        │
        ▼
that source's resolve() - calls an existing, unmodified src/lib/frappe/*.server.ts fetcher
        │
        ▼
Frappe
```

The contract (`types/runtime/data-source.ts`):

```ts
type DataSourceDefinition<TResult = unknown> = {
  id: string;
  description: string;
  capabilities: { list?: boolean; detail?: boolean; aggregate?: boolean; search?: boolean; filter?: boolean; sort?: boolean; pagination?: boolean };
  fields: { name: string; label: string; type: "string" | "number" | "boolean" | "date" | "currency" }[];
  resolve: (context: { searchParams: Record<string, string | string[] | undefined> }) => Promise<TResult>;
};
```

`resolve`'s parameter (`DataSourceContext`) is the source's "params," and its
return type `TResult` is its "returns" - both already exist, just as a
function signature rather than separate named fields, since a data source's
real contract is exactly "what you call it with" and "what you get back."

`resolvePageData` (`data/resolver.ts`) walks a definition, collects every
unique `source` id any node's `data` map references, and resolves each one
exactly once through the registry, in parallel - a page's JSON stays the
single source of truth for what data it needs, with no separate loader to
keep in sync by hand. `UIRenderer` itself just receives a flat
`Record<string, unknown>` keyed by source id.

Two source files exist today, `data/sources/dashboard.ts` (`dashboard.overview`,
`dashboard.greeting`, `dashboard.salesTrend`, `dashboard.topProducts`,
`dashboard.stockMix`, `dashboard.recentOrders`) and `data/sources/customers.ts`
(`customers.overview`, `customers.trend`, `customers`) - each `resolve()`
calls the exact fetchers `/os` and `/os/customers` always used
(`getDashboardOverviewServer`, `getCustomersServer`, etc.), just now called
from one shared place instead of a page-specific loader. UI JSON never
contains a Frappe method path, SQL, or an arbitrary function name - only a
semantic source id like `"customers"` or `"dashboard.salesTrend"`.

## Generic Frappe Data Sources

`dashboard.ts`/`customers.ts` are bespoke: each `resolve()` is hand-written
against a page-specific fetcher, right for business calculations (KPI
comparisons, derived statuses, multi-fetch aggregates). Most data needs
aren't that - "list this DocType's rows, these fields, this filter, this
order" (or "how many rows match this filter") is an ordinary shape that used
to need a new fetcher and a new source file every time anyway. `frappe-list`/
`frappe-count` are a second, generic path for exactly that case - and unlike
when they were first introduced, a page definition declares one **directly**,
with no source file and no `registerDataSource()` call:

```
UI Definition's `data` binding
  { rows: { source: { type: "frappe-list", doctype: "Customer", ... }, path: "data" } }
        │
        ▼
resolvePageData (runtime/data/resolver.ts) - collects every referenced source
        │
        ▼
resolveSource - a string dispatches through the (unchanged) Data Source
Registry; an inline config dispatches on its own `type` instead
        │
        ▼
createFrappeListSource(config).resolve() / resolveFrappeCount(config) - frappeFetch(...)
        │
        ▼
Frappe's standard /api/resource/<Doctype> or /api/method/frappe.client.get_count endpoint
```

A `DataSourceRef.source` (`types/runtime/data-source-ref.ts`) is now either a
named registry id (the original, still-primary case - `dashboard`/
`customers`, entirely unchanged) **or** a plain declarative object:

```ts
{
  rows: {
    source: {
      type: "frappe-list",
      doctype: "Customer",
      fields: ["name", "customer_name", "customer_group", "territory"],
      filters: [{ field: "disabled", operator: "=", value: 0 }],
      orderBy: "modified desc",
      pagination: { pageSize: 20 },
    },
    path: "data", // pulls just the row array out of FrappeListResult
  },
}
```

`id`/`description` (`types/runtime/frappe-list.ts`'s `FrappeListSourceConfig`)
are optional precisely because of this - they're only needed for the
*other*, still-available use case: a future concrete source file calling
`registerDataSource(createFrappeListSource({ id, description, ... }))` to
register a named, reusable generic source the ordinary way. An inline config
has no id to register in the first place.

**Dispatch lives in `resolver.ts`, not the registry.** `resolveSource`
branches on `typeof source`: a string goes through the unchanged
`getDataSource(id)?.resolve(context)` path; an object dispatches on its own
`type` via an exhaustively-checked (`never`) switch -
`"frappe-list"` → `createFrappeListSource(source).resolve(context)`,
`"frappe-count"` → `resolveFrappeCount(source)`. The registry itself never
learns about either type - an inline config has no id to look up, so a
registry-shaped mechanism doesn't fit it. Two independent tree-walks need to
agree on a lookup key for the same inline config without sharing state
(`resolvePageData`, which builds the flat `data` record server-side, and
`resolveDataSource`, called per-node at render time) - `resolve-data-source.ts`'s
`sourceKey()` handles this: a string is already a stable key, an inline
object gets a stable, key-sorted stringification (not raw `JSON.stringify`,
which would let two byte-equal-but-differently-key-ordered configs fail to
dedup). Two nodes referencing identical inline configs collapse to one
Frappe call, the same "resolve each unique source exactly once" property the
registry path always had.

`resolve()` calls `frappeFetch` - the same server-side BFF call every
existing `*.server.ts` fetcher already uses - against Frappe's *standard*
doctype REST endpoint (`/api/resource/<Doctype>`) or
`frappe.client.get_count`, not a custom whitelisted method the way
`dashboard.ts`/`customers.ts` do. No second HTTP client, no new API route,
same cookie-forwarded session Frappe stays authoritative over (no
client-side permission logic here - an unauthorized filter or field just
gets Frappe's own permission error, which the resolver turns into the same
safe-empty result as any other failure).

**A real page proves this**: `seeds/pages/seed-data.ts`'s
`HEADLESS_DATA_TEST_PAGE` (`/os/headless-data-test`) - a `PageHeader`, a
`frappe-count`-backed KPI, and **two** independently-paginated,
`frappe-list`-backed `os-data-table`s (`Customer` and `Sales Order`), no
page-specific fetcher anywhere. `?customers_page=2&orders_page=5` moves
each table independently - the concrete proof the namespaced convention
above exists for. Both tables deliberately request only genuine native
DocType fields (`Customer`'s `name`/`customer_name`/`customer_group`/
`territory`; `Sales Order`'s `name`/`customer`/`transaction_date`/
`grand_total`/`status`) through the standard REST endpoint - unlike
`HEADLESS_CUSTOMERS_PAGE`'s bespoke `customers` source, which also carries
`orders`/`total_spend` computed by a custom whitelisted API method the
generic source has no way to reach. That's the real, honest boundary between
"generic Frappe access" and "domain-specific computation," not a coincidence
of column choice. No filter is wired into this page - it predates
request-driven filtering (see "Generic List Query State" below, and
`/os/suppliers`, which proves that instead).

**What's supported**: field selection (`"name"`, every doctype's primary
key, is always requested even if the config omits it, so a resolved row is
never missing a stable id), a restricted filter-operator set (`=` `!=`
`like` `not like` `>` `<` `>=` `<=` `in` `not in` - a subset of the fuller
`FilterOperator` vocabulary already in `types/list.ts`), single- or
multi-field `order_by`, and fixed-page-size pagination via an over-fetch
trick: the resolver requests `pageSize + 1` rows and trims the extra one,
which is how `hasMore` is known without a separate count call (Frappe's
list endpoint returns no total by default).

## Paginated Data Sources

Pagination is now genuinely interactive, URL-driven, and safe for multiple
independent paginated sources on one page:

```
Data Source (a page-level named `data` entry)
        │
        ▼
{ data, pagination: { page, pageSize, hasMore } }        ← FrappeListResult
        │                     │
        ▼                     ▼
  { ref, path:"data" }   { ref, path:"pagination" }        ← two component bindings,
        │                     │                              ONE resolution
        ▼                     ▼
   os-data-table's        os-data-table's
   `rows` prop             `pagination` prop
        │
        ▼
  user clicks Next/Previous → usePaginationParam writes `?<name>_page=`
        │
        ▼
  router.replace (client nav, no reload) → the named source re-resolves
```

**A source needs an explicit, stable name to be interactively paginated.**
`UIPageDefinition` (`types/runtime/page.ts`) gained an optional page-level
`data: Record<string, FrappeListSourceConfig | FrappeCountSourceConfig>` -
a source declared **once, by name**, e.g.:

```ts
definition: {
  data: {
    customers: { type: "frappe-list", doctype: "Customer", fields: [...], pagination: { pageSize: 10 } },
    orders: { type: "frappe-list", doctype: "Sales Order", fields: [...], pagination: { pageSize: 10 } },
  },
  children: [
    { id: "customers-table", type: "os-data-table", props: { pageParam: "customers_page", ... },
      data: { rows: { ref: "customers", path: "data" }, pagination: { ref: "customers", path: "pagination" } } },
    { id: "orders-table", type: "os-data-table", props: { pageParam: "orders_page", ... },
      data: { rows: { ref: "orders", path: "data" }, pagination: { ref: "orders", path: "pagination" } } },
  ],
}
```

`DataSourceRef` (`types/runtime/data-source-ref.ts`) gained a second shape
alongside the existing `{ source, path? }`: `{ ref, path? }`, naming a
`definition.data` entry instead of carrying (or duplicating) a source config
itself. `resolver.ts`'s `resolveNamedData` resolves every `definition.data`
entry exactly once, into the flat data record under `` `page-data:${name}` ``
- a keyspace deliberately separate from `sourceKey`'s (a bare registry id,
or a stable-stringified anonymous inline config), so a page reusing the same
word for both a named entry and, say, a registered string source can never
collide, and so an anonymous inline binding elsewhere on the page does
*not* dedup against a named entry even if byte-for-byte identical - a
disclosed non-goal, not an oversight (`sourceKey`-based dedup is unchanged
and still applies to every anonymous binding). Two component bindings
naming the same entry (`rows`/`pagination` above) share that one resolution
- confirmed by test (`resolver.test.ts`), not just by inspection.

**Why an explicit name, not an auto-picked default.** An anonymous inline
`frappe-list` binding (no `definition.data` entry) always uses its own
static `pagination.page` - no URL reading, no interactivity. The
alternative - auto-namespacing "the sole `frappe-list` source" on a page -
is exactly the bug this mechanism exists to rule out, just deferred: the
day a second table is added (`HEADLESS_DATA_TEST_PAGE`'s own proof point),
*which* source silently keeps the default namespace becomes order-dependent
again. A one-line author cost (naming the entry) permanently rules out the
whole collision class instead of narrowing it.

**The URL convention is `${name}_page`** (`customers_page`, `orders_page`) -
the only existing "derive a compound param from a base name" precedent in
this codebase before this phase was `os-filter-bar`'s date-range
`${searchParam}_from`/`_to`; this matches it exactly, stays flat (Next's
`searchParams` prop has no bracket-object parsing built in - `?page[x]=`
would need a parsing library nothing here has), and carries no
Frappe-specific words. `resolver.ts`'s `readNamedPage` is the *only* place
a page number is read from the URL - `frappe-list-resolver.ts` itself has
zero `searchParams` awareness anymore (an earlier version of this resolver
read a flat, unnamespaced `?page=` directly; that's exactly the bug fixed
by moving this concern up to the one layer that knows a source's name).

**`os-data-table`/`OsDataTable` never sees `limit_start`/`limit_page_length`
- only `{ page, pageSize, hasMore }`.** Two new optional props,
`pagination` (data-bound, e.g. `{ ref: "customers", path: "pagination" }`)
and `pageParam` (a plain `props` string, e.g. `"customers_page"`). When
`pagination` is present, `OsDataTable` sets TanStack's `manualPagination: true`
and skips `getPaginationRowModel()` entirely (the resolved `data` is already
just the current page - re-slicing it client-side would silently show an
empty "page 2"); a new, genuinely generic (zero Frappe/doctype knowledge)
`usePaginationParam` hook (`components/registry/data-table/use-pagination-param.ts`)
owns reading/writing the named URL param, using the exact same
clone-`URLSearchParams`-then-`router.replace(..., {scroll:false})` pattern
`OSPeriodToggle`/`OsFilterBar` already use - client navigation, no full
reload, every other search param preserved, browser back/forward just works,
for free. `PaginationFooter` gained an `external` mode (`hasMore`-driven
Next/Previous instead of a `totalCount`-derived page count, since no true
total exists) that leaves its default `totalCount`-based rendering - and
every table not passing these new props - completely untouched.
**No `pageParam` means Next/Previous render disabled**, not hidden and not
silently inert - loud, matching this codebase's "unknown type renders a
visible placeholder, never nothing" convention (`UnknownNodePlaceholder`) -
plus a dev-only `console.warn` naming the missing prop.

**Filter change resets the relevant page.** `os-filter-bar` gained an
optional `resetPageParams: string[]` prop - any filter value change (or
Reset) also deletes every param listed there, alongside the filter's own.
Fully generic: the filter bar never knows what `"customers_page"` *means*,
only that it should go away. There was no existing "filter change resets
pagination" behavior to reuse (`setParam`/`reset` only ever touched their
own filter param(s) before this) - this is the smallest mechanism that
makes the rule real without page-specific logic anywhere.

**Filter values are passed through exactly as configured - no wildcard
injection.** The end-user-facing `toFrappeFilters` (`components/derived/list/types.ts`)
auto-wraps a `like`/`not like` filter's value in `%...%`, because it's
built from live text-input search. `frappe-list`'s filters are
developer-authored declarative config instead, so the config author writes
the literal Frappe value - `"%foo%"`, `"foo%"`, whatever match they want -
rather than having the resolver silently rewrite it. Same operator
vocabulary, deliberately different wildcard behavior; don't assume the two
agree.

**`frappe-count`** (`types/runtime/frappe-count.ts`, `runtime/data/frappe-count-resolver.ts`)
is `frappe-list`'s intentionally tiny sibling - "how many rows match this
filter," nothing more. `{ type: "frappe-count", doctype: "Customer", filters?: [...] }`,
reusing `frappe-list`'s own filter vocabulary so the two can't drift apart.
Calls `frappe.client.get_count` (the same endpoint `lib/frappe/logs.ts`'s
`fetchLogCount` already proves out for a different doctype) and returns a
plain `number`, `0` on any failure, never throws. No `id`/`description`, no
standalone `DataSourceDefinition` wrapper, no validate-or-throw guard inside
the resolver itself - it's only ever reached inline, after
`validatePageConfig` has already zod-validated the whole page, so a second
check would be dead code rather than defense in depth.

**Explicitly deferred, not forgotten:**

- Aggregations, joins, SQL, or any universal query language.
- DocType-meta-driven field `label`/`type` - `createFrappeListSource`
  currently synthesizes a label (title-cased field name) and defaults every
  field's `type` to `"string"`, since fetching real DocField metadata is
  out of scope ("do not attempt full DocType metadata validation"). Every
  `frappe-list`-backed page uses handwritten, explicit `os-data-table`
  column specs instead of this synthesized metadata - prefer that over
  inventing a metadata system.
- Boolean filter values - Frappe `Check` fields query as `0`/`1`, not JSON
  `true`/`false`, and nothing exercises that path yet to confirm the
  mapping against, so `FrappeListFilter.value` doesn't accept `boolean`.
- The `between`/`is`/`is not` operators (`types/list.ts`'s fuller
  `FilterOperator` vocabulary has them; `frappe-list` doesn't yet - they
  need a different value shape than an ordinary list filter does). Also not
  in `queryFilters`' own operator set (see "Generic List Query State" below)
  for the same reason, plus `in`/`not in` - no UI here produces an array
  value for a request-driven filter.
- Page *size* is not URL-addressable, only page *number* - `pageSize` comes
  from the named entry's own config; `PaginationFooter`'s "Per page"
  selector is suppressed entirely in external/manual mode rather than left
  connected to nothing. No existing page-size control anywhere in this
  codebase to make request-aware in the first place.
- `applyUIAction`'s mutation vocabulary (`runtime/mutations.ts`) has no verb
  for `UIPageDefinition.data` yet - nothing calls `applyUIAction` in
  production regardless, so this is a flagged follow-up, not a blocker (see
  "Generic List Query State" below for the fuller reasoning).

**Bespoke sources aren't going away.** `dashboard.ts`/`customers.ts` remain
the right shape for business calculations and multi-step logic;
`frappe-list`/`frappe-count` are additive - a second, simpler path for the
ordinary case, not a replacement for the sources that already exist.

## Generic List Query State

Pagination (above) was the first piece of a `frappe-list` source's request
state to become genuinely interactive. This phase does the same for
filters, search, and sorting - all namespaced by a named entry's own name,
the same `${name}_<thing>` convention `${name}_page` already established, so
any number of independent lists on one page stay safe from each other.

```
Data Source (a page-level named `data` entry)
        │
        ▼
config.filters (static) + config.queryFilters/search (capability declarations)
        │
        ▼
${name}_filter_<field> / ${name}_search / ${name}_sort URL params  ← resolver.ts reads these
        │
        ▼
effective filters / orFilters / orderBy   ← merged, once, in resolveNamedData
        │
        ▼
createFrappeListSource(effectiveConfig, { orFilters }).resolve()
        │
        ▼
{ data, pagination, orderBy }   ← orderBy is new: echoes the effective sort back
```

**Filters: `queryFilters` declares eligibility, the URL supplies the value.**
`FrappeListSourceConfig` gains `queryFilters?: { field, operator }[]` -
alongside the existing static `filters` (always applied, config-owned,
non-negotiable), each `queryFilters` entry names one *additional* field a
named entry allows filtering by, and with what operator. The actual value
is never author-supplied: it's read from `` `${name}_filter_<field>` ``
(`resolver.ts`'s `readNamedFilters`) and merged into the effective `filters`
array at resolve time. Because the *field* always comes from author-written
config and only the *value* comes from the URL, this can never inject an
arbitrary field into a Frappe query - the same safety property `${name}_page`
already had for pagination. A field cannot be declared in both `filters` and
`queryFilters` on the same config (`config/frappe-list-schema.ts`'s
`.refine()`) - both would AND together on that field, silently producing an
always-empty result if they ever disagreed.

**Search: a capability declaration plus Frappe's `or_filters`.** `search?:
{ fields: string[] }` declares which fields a named entry allows searching
across; a live term at `` `${name}_search` `` becomes a `like` match against
each declared field, sent as `or_filters` (`buildFrappeListRequestPath`'s new
second parameter) - a real, precedented Frappe REST parameter (this
codebase's own obsolete `supplier-list.ts`/`sales-order-list.ts` fetchers
already use it against this exact endpoint), which combines with `filters`
as `filters AND (or_filters)` - the expected "narrow further within the
already-filtered set" search-box semantics. This is not full-text search -
it's only ever a `like` match against the fields a config explicitly lists,
nothing Frappe-side is being asked to do beyond that.

**`orFilters` is deliberately not a `config` field.** Unlike `pagination.page`
(a value an author may legitimately set as a static default), the search
term's derived OR-filter tuples have no legitimate author-facing use - so
they're never added to `FrappeListSourceConfig`/its `.strict()` zod schema.
Putting them there would let an author hand-write `orFilters` in page JSON,
which `resolveNamedData` would then silently clobber every single request.
Instead they flow as a second, non-schema-validated parameter:
`createFrappeListSource(config, { orFilters })`.

**The `like`/`not like` auto-wrap exception is narrowly scoped.** A
`frappe-list` config's own static `filters` are never auto-wrapped - an
author writes the literal Frappe value they want, wildcards included, by
design. A `queryFilters`-sourced value *is* auto-wrapped in `%...%` when its
operator is `like`/`not like` - the same treatment the end-user-facing
`toFrappeFilters` (`components/derived/list/types.ts`) already gives live
text input - because this value genuinely is live end-user text arriving
through a URL param, not developer-authored config. This wrapping happens in
exactly one function (`resolver.ts`'s `readNamedFilters`); nothing else can
retroactively wrap a static value.

**Sorting is a real `OsDataTable` mechanism, not an `OsFilterBar` control.**
A disconnected "Sort by" dropdown was considered and rejected: `OsDataTable`
already owns exactly this kind of generic, Frappe-agnostic, named-URL-param
mechanism for pagination (`pageParam`/`usePaginationParam`), so a
symmetrical `sort`/`sortParam` pair (mirroring `pagination`/`pageParam`
exactly) is equally "Frappe-agnostic," and lets a sortable column header
behave correctly instead of being replaced by an unrelated control.
`sort` is a data-bound prop (e.g. `{ ref: "suppliers", path: "orderBy" }` -
`FrappeListResult` gained an `orderBy` field for exactly this, echoing the
effective sort back the same way `pagination` already echoes effective page
state); `sortParam` is the URL param name (e.g. `"suppliers_sort"`). A new
`useSortParam` hook (`components/registry/data-table/use-sort-param.ts`)
mirrors `usePaginationParam`'s clone-`URLSearchParams`-then-`router.replace`
pattern, holding one literal `"field asc|desc"` string - the exact format
`orderBy` itself already uses, no new mini-language - and clearing a given
`resetParams` list (this table's own `pageParam`) in the same navigation, so
changing sort resets the relevant page without `OsFilterBar` involvement.
`getSortedRowModel()` is skipped entirely in this mode, the same reasoning
`getPaginationRowModel()` is already skipped for manual pagination: the
resolved `data` is already sorted server-side.

This fixed a real, already-shipped bug: `HEADLESS_DATA_TEST_PAGE`'s tables
already marked columns `sortable: true` while paginating via `pageParam` -
since `getSortedRowModel()` was unconditionally wired before this phase,
clicking those headers silently re-sorted only the current page's rows, not
the full result set. Both tables now also declare `sortParam`/`sort`,
making the existing sort columns genuinely correct instead of quietly wrong.

**`readNamedSort` is the actual security/correctness boundary for sorting.**
A request-supplied `` `${name}_sort` `` must match `ORDER_BY_PATTERN`
(exported from `config/frappe-list-schema.ts`, now shared with a
`parseOrderByFields` helper) *and* every field it references must be one of
the named entry's own declared `fields` or `"name"` - an arbitrary
URL-supplied sort field must never reach Frappe unchecked. Invalid or absent
falls back to the config's own static `orderBy`.

**An anonymous inline `frappe-list` binding's `search`/`queryFilters` are
inert, loudly.** Exactly like an anonymous binding's static `pagination.page`
(no URL reading at all - see "Paginated Data Sources" above), an anonymous
config declaring `search`/`queryFilters` has nothing to read them: only
`resolveNamedData` (reached only for a named `definition.data` entry) ever
looks at `` `${name}_search` ``/`` `${name}_filter_<field>` ``.
`resolver.ts`'s generic `resolveSource` dispatcher - now reached *only* by
anonymous bindings, since a named entry's `frappe-list` config is resolved
directly by `resolveNamedData` instead (the one place `orFilters` needs to
flow) - warns in dev when this happens, matching this codebase's "loud, not
silently inert" convention (the same one behind `OsDataTable`'s missing-
`pageParam` warning).

**`/os/suppliers` is the proof**: a second real, production-style
`frappe-list` page (`HEADLESS_SUPPLIERS_PAGE`) with no bespoke fetcher,
source file, or `registerDataSource()` call anywhere - a `text` "Search"
filter (`suppliers_search`), a `text` "Country" filter
(`suppliers_filter_country`, `like`), sortable `name`/`supplier_name`
column headers (`suppliers_sort`), and pagination (`suppliers_page`), all
resolved through one named `frappe-list` entry. `Supplier` over `Product`:
no live route uses either doctype, but `obsolete/pages/os/products/` is a
genuinely heavy implementation (variant grid, image carousel, child rows, a
detail route) - real scope-creep risk this phase doesn't need. The only
obsolete `Supplier` code is a single-purpose list-search fetcher with no
detail page - and it's the direct precedent for the `search` mechanism above
(same field choice: `supplier_name`, `name`). Since `createFrappeListSource`
never fetches real DocType metadata (a standing non-goal), this page's
`supplier_group`/`country` fields were manually smoke-checked against a real
Frappe site rather than assumed correct - a wrong field name fails silently
as an always-empty column, not an error.

**`applyUIAction` and `UIPageDefinition.data`: decided, not yet built.**
Once Ask Alaiy can add a data-bound component, it will also need to
introduce the named source that binding points at - so
`ADD_DATA_SOURCE`/`REMOVE_DATA_SOURCE`/`UPDATE_DATA_SOURCE`-shaped verbs on
`UIPageDefinition.data` are anticipated. Nothing calls `applyUIAction` in
production today regardless (the same is already true of every existing
verb), so there's no concrete caller to build and test against yet - this is
a recorded decision, not an implementation.

## The Component Registry: a machine-readable contract

Every component lives in one base registry (`runtime/registry/component-registry.ts`)
- nothing is feature-specific, because `columns`/`series`/`filters` are all
plain, JSON-safe declarative specs rather than React code:

| type | name | component | category | AI-exposed | contract |
|---|---|---|---|---|---|
| `os-page-header` | Page Header | `PageHeader` | `page` | yes | title/subtitle/action slot (pre-existing) |
| `os-card` | Card | `OsCard` | `layout` | yes | generic chrome wrapper |
| `os-kpi` | KPI | `OsKpi` | `data-display` | yes | `value`, `format`/`currency`/`precision`, `trend`/`trendUnit`/`trendPolarity`, `borderTone` |
| `os-chart` | Chart | `OsChart` | `data-display` | yes | `x`, `series: {field,label,type:"bar"|"line"|"area"}[]`, `legend`, `rows` |
| `os-data-table` | Data Table | `OsDataTableView` | `data-display` | yes | `columns: {field,label,format,align,sortable,filterable,badgeTones}[]`, `rows`, search/filter/columnVisibility/selectable/paginated |
| `os-filter-bar` | Filter Bar | `OsFilterBar` | `filtering` | yes | `filters: {id,type:"select"|"text"|"date-range",label,searchParam,options,defaultValue}[]` |
| `os-period-toggle` | Period Toggle | `OSPeriodToggle` | `filtering` | yes | pre-existing, `?period=` only |

These are **semantic** components, not shadcn primitives - the registry
never exposes `Button`/`Popover`/`Separator`/etc. directly. A semantic
component's own implementation is free to use as many primitives as it
needs internally (`OsKpi` composes `Card`, `Badge`; `OsDataTableView`
composes `Table`, `Select`, `Popover`...) - what makes something
registry-worthy is that a user could plausibly ask Ask Alaiy to add or
change it as a unit ("add a KPI," "add a filter"), not "add a Popover."

Every entry (`types/runtime/registry.ts`'s `ComponentRegistryEntry`) also
declares:

```ts
{
  name?: string;                              // human-readable label, distinct from `type`
  category?: "page" | "layout" | "data-display" | "filtering";
  ai?: { exposed?: boolean };                 // may Ask Alaiy reason about/place this? see below
  capabilities: { movable?: boolean; resizable?: boolean };
  allowedParents: (LayoutType | ComponentType)[]; // e.g. ["grid", "stack", "section"]
  supportsChildren: boolean;
  requiredFields?: string[]; // e.g. os-kpi: ["title", "value"]
  propsSchema?: ZodTypeAny; // per-type shape check on literal `props` (config/component-props-schema.ts)
}
```

`name`/`category`/`ai`/`capabilities`/`allowedParents`/`supportsChildren`/
`requiredFields`/`propsSchema` are all optional on the *type* (so a minimal
ad hoc override - a test fixture, an early feature-specific entry - still
type-checks), but every real entry in `baseComponentRegistry` populates all
eight.

### Composing registries: base + contributed

`mergeRegistries(...registries)` (`runtime/registry/component-registry.ts`)
does `Object.assign({}, ...registries)` - last-registry-wins on a key
collision, deliberately: this is an override mechanism (a feature or
connector replacing a base type's implementation), not an error condition.
`resolve-page.tsx` computes `effectiveComponentRegistry =
mergeRegistries(baseComponentRegistry, contributedComponents)` once at
module scope and uses that for every request.

`contributedComponents` (`config/contributed-components.ts`) is the
**`components` extension point** - the same build-time contribution
mechanism `contributed-nav.ts` and the (now-obsolete) `products` point
already established; see
`CONNECTOR_TO_BASE_UI_COMPOSITION.md` §16.1 for how a connector declares
one and how the composer generates this file. It ships empty in `alaiy_os`,
so today's merge is a no-op - the seam exists and runs on every request,
but nothing uses it yet. Unlike `products`, this point reuses the
registry's own `ComponentRegistry` type directly as its contract; no
bespoke type module was needed, because `ComponentRegistry` is already
fully general.

### Considered and deferred: component vocabulary

The registry is deliberately small. A thorough audit of `obsolete/` (every
retired page's real implementation) and the live codebase found three
families worth naming explicitly, so the reasoning is discoverable next to
the registry itself rather than left implicit:

- **Entity detail** (`entity-header`, `entity-summary`, `related-records`,
  `record-list`, `record-actions`) - genuinely good implementations exist
  in `obsolete/pages/os/sales/orders/[id]/` (header + summary + linked
  documents + status-gated actions), but that DocType (and Purchase Orders,
  and Products) has no live route today - only `/os` and
  `/os/customers` are real, and neither is a detail page. Building these
  now would have zero consumer. The obsolete Sales Order detail page is the
  concrete reference to promote from once a real detail-page route exists.
- **Forms** (`form`, `form-section`, `form-field`, `form-actions`) - there
  is no generic, schema-driven form abstraction anywhere in the codebase to
  promote; `react-hook-form` is used in exactly one file
  (`components/baseline/auth/login-form.tsx`), and every settings page
  hand-rolls its own `useState` form. Building this now would be built from
  nothing, not promoted from something real.
- **Standalone status/feedback** (`status`, `empty-state`, `loading-state`,
  `error-state`, `progress`) - "status" already has a real, generalized
  implementation: `os-data-table`'s `format: "badge"` column type plus
  `STATUS_TONE` (`constants/list.ts`). Empty/loading/error are properties
  of a data-bound component's *own* state (`os-chart`/`os-kpi`/
  `os-data-table` each already render their own inline empty/loading/error
  state) - not something a user asks Ask Alaiy to add as a separate node.

Also deferred, same reasoning (no live implementation to promote, or no
live consumer): `breadcrumb` and `page-actions`/`action-bar` (already
served by `os-page-header`'s `action` slot composing `os-filter-bar`/
`os-period-toggle` via an `inline` layout - proven live on both real
pages), new `os-chart` series types beyond bar/line/area, new
`os-filter-bar` filter kinds beyond select/text/date-range, and
`os-data-table` capabilities like expandable child rows or a bulk-action
menu (both existed in `obsolete/`, neither with a live consumer). The
wider Tier-2 list - `timeline`, `activity-feed`, `comments`, `attachments`,
`approval-status`, `workflow-status`, `document-summary`,
`document-timeline`, `kanban`, `calendar-view`, `wizard`, `stepper`,
`file-list` - has no implementation anywhere in this codebase, live or
obsolete, to promote from.

`requiredFields` and `propsSchema` check two different things:
`requiredFields` is about *presence* - is a component missing something it
can't render without - checked against the *union* of a node's `props` keys
and `data` keys, since some required values (`os-kpi`'s `value`) are always
supplied via a data binding, never a literal prop. `propsSchema`
(`config/component-props-schema.ts`, one zod object per type) is about
*shape* - given whatever literal props a node actually has, does each one's
value match its type (a string where a string is expected, one of the
registered KPI icon names, one of the six `KPI_BORDER_TONES`, and so on).
Every field in a `propsSchema` is declared `.optional()`, even a
`requiredFields`-listed one, precisely because a data-bound field is
legitimately absent from `props` - only `requiredFields` judges presence.
Each schema is `.strict()`, so an unrecognised prop key (a typo, a stale
field a past version of the component read) is a validation error instead
of a silent no-op.

`allowedParents`/`supportsChildren` are consumed by
`runtime/validate/validate-against-registry.ts` (next section) - not by the renderer,
and not by `runtime/mutations.ts`. `ADD_COMPONENT`/`MOVE_COMPONENT` still
only check "is the parent a layout node at all," a deliberate v1
simplification predating this contract (see that file's module doc) - using
the finer-grained `allowedParents` there too would be a natural next step.

## A second validation pass: `runtime/validate/validate-against-registry.ts`

`runtime/validate/validate.ts` is deliberately *structural only* - it checks a
component `type` as a non-empty string, not against the registry, so
vocabulary and structure stay two separate concerns (see that file's own doc
comment). `validate-against-registry.ts` is the vocabulary-aware pass that
was missing: given an already structurally-valid `PageConfigFile`, a
`ComponentRegistry`, and a way to check whether a `data` binding's `source`
id is really registered, it walks the tree and reports every:

- unknown component `type` (not resolvable in the given registry)
- component placed under a parent type not in its `allowedParents`
- component with a non-empty `children` array whose entry has
  `supportsChildren: false`
- component missing one of its `requiredFields` (checked against the union
  of `props` and `data` keys)
- literal `props` value that fails its type's `propsSchema` (an unrecognised
  icon/tone name, a wrong-typed field, an unrecognised prop key - `.strict()`
  catches typos too)
- `data` binding whose `source` was never registered
- `layout.span` or grid `columns` value with no matching Tailwind class in
  `config/layout-classes.ts`'s lookup tables (`isValidSpanValue`/`isValidGridColumnsValue`)

`resolve-page.tsx` runs this right after loading a config from the store and
before resolving any data - a definition that fails it returns the same
`{ status: "invalid", errors }` shape a structurally-invalid one already did,
never a stack trace. Both real seed pages are covered by a dedicated
regression test (`tests/runtime/validate/validate-against-registry.seed.test.ts`) that
runs this exact gate against `HEADLESS_DASHBOARD_PAGE`/`HEADLESS_CUSTOMERS_PAGE`
and the real Data Source Registry, so a future edit that quietly breaks
either page's placement, required fields, or data bindings fails a test
instead of failing silently at request time.

### Why this is possible without per-feature components

Passing a raw TanStack `ColumnDef` (a function) or a bespoke chart component
from a Server Component to a Client Component crashes - functions can't
cross that boundary, only plain data and pre-rendered React elements can.
The fix: `OsDataTableView`/`column-spec.tsx` turn a declarative, JSON-safe
column spec into real `ColumnDef`s **inside** the client component that
renders them, and `OsChart` takes a declarative `series` spec instead of
being handed a chart implementation. That's what lets `os-data-table`/`os-chart`
live in one shared, generic registry instead of a per-feature one.

**Disclosed simplifications** (capabilities more bespoke components might
have had that these generic ones don't):
- Per-row currency (an order's own currency vs. the org default) is gone -
  `os-data-table` takes one `currency` prop applied to every row.
- The dashboard's channel filter is gone - its options are inherently
  dynamic per-site data, and `filter-bar`'s contract doesn't yet support a
  data-bound options list (a real next step, not implemented here).
- No data-bound `filter-bar` options list yet (same point as above).

## The Renderer

`<UIRenderer definition={...} data={...} registry={...} />` (`runtime/ui-renderer.tsx`)
walks the tree, resolves layout nodes against the (single, global) layout
registry, resolves component nodes against whichever registry was passed in,
merges `props` with the already-resolved `data`, and renders. An unknown
`type` renders an inline placeholder instead of throwing. No `eval`, no
dynamically generated TSX, no filesystem access from the renderer itself.

## The dynamic route

```
src/app/(platform)/os/page.tsx            - bare /os only; hardcodes resolvePage("dashboard", ...)
src/app/(platform)/os/[...page]/page.tsx  - everything else under /os with no static route,
                                            including /os/customers
```

`resolvePage(id, searchParams)` (`runtime/resolve-page.tsx`): look up the id
in the current `UIPageStore`, run `validateAgainstRegistry`, resolve its
data via `resolvePageData`, render through `UIRenderer` (or a
`pageFeatures[id].render` override - `pageFeatures` is empty today; see "UI
Actions" below for why). A missing id renders the same "coming soon"
placeholder every other not-yet-built sidebar link already shows; an invalid
one (fails structural or registry validation) renders a distinct, controlled
error state - never a stack trace.

Static siblings (`ask-alaiy`) always win over the catch-all - Next's own
router guarantees this, no special-casing needed.

## UI Actions

`runtime/mutations.ts` - `applyUIAction(definition, action)`,
`ADD_COMPONENT`/`REMOVE_COMPONENT`/`MOVE_COMPONENT`/`UPDATE_COMPONENT`, pure
and immutable. `MOVE_COMPONENT` validates against the *original* tree before
removing anything - an unknown/cyclic/non-layout target rejects the action
and returns the definition untouched, and reorders within the same parent
correctly (covered by `tests/runtime/mutations.test.ts`, including explicit
immutability/sibling-identity assertions). Not persisted anywhere, and
nothing calls it in the running app today - the dev-only proof that it
worked (two demo buttons on the old `/os/headless` test route) was retired
once that page became a real production route; the component moved to
`obsolete/ui-runtime/dev/headless-mutation-demo.tsx`. The action module
itself, and its full test coverage, are unaffected - only the one dev-only
caller is gone.

## What is intentionally not implemented

- No Ask Alaiy / LLM integration of any kind.
- No writing back to SQLite from the running app - `applyUIAction`'s results
  live only in a caller's own state; the database is read-only from the
  app's perspective today.
- No Frappe-backed `UIPageStore`, no versioning beyond the schema's plain
  `version` counter, no rollback, no multi-user permissions, no publishing
  workflow (see "Planned" below for the intended shape).
- No arbitrary component generation or arbitrary JavaScript execution.
- No visual page builder, no drag-and-drop editor.
- No data-bound `filter-bar` options (a real next step - see above).
- No per-feature type-extension mechanism for `ComponentType` - one flat
  closed union, manageable at this scale.

## Planned (not started): Frappe-backed persistence

Once the runtime has proven itself against more real pages, UI definitions
should move from SQLite-seeded TypeScript to genuinely persisted, versioned,
Frappe-backed records. The conceptual model - **not implemented, no
DocTypes exist yet, this is a design note for the next phase**:

```
OS UI Page               OS UI Page Version         OS UI Change
├── route                ├── page (FK)              ├── page (FK)
├── current_version (FK) ├── version                ├── actions (structured)
└── scope                ├── definition              ├── before_version (FK)
                          └── metadata                ├── after_version (FK)
                                                       └── actor
```

- **OS UI Page** - the published pointer: which version is currently live
  at a route, and its scope (system/organization/user).
- **OS UI Page Version** - an immutable snapshot of a definition, enabling
  rollback and history.
- **OS UI Change** - an audit record of one proposed/applied action set,
  who made it, and which version it produced - the foundation for preview,
  approval, and rollback before Ask Alaiy gets write access.

This intentionally does not replace `UIPageStore`/`SidebarStore` as
interfaces - a future `FrappePageStore`/`FrappeSidebarStore` would implement
them against these DocTypes, and nothing above that interface (the dynamic
route, `resolve-page.tsx`, the renderer, the registries) would need to
change.

## Where Ask Alaiy plugs in later

None of this changes today. The intended future flow:

```
User: "Create a customer analytics page."
        │
        ▼
   Ask Alaiy (interprets the request)
        │
        ▼
   Structured UI Actions + Data Source references
        │
        ▼
   applyUIAction / a new UI Definition  — already exists, unchanged
        │
        ▼
   Persisted as an OS UI Page Version (not implemented - see "Planned" above)
        │
        ▼
   /os/<new-route> resolves through the same /os/[...page] catch-all — already exists, unchanged
```

The LLM would never be trusted to emit React or TSX - only structured
actions and data-source references against the same closed vocabulary this
runtime already validates by hand.

**Registered, renderable, and AI-exposed are three different things.** Every
entry in `baseComponentRegistry` is registered (has a real component) and
renderable (the `UIRenderer` can resolve and mount it) - but only entries
with `ai.exposed: true` should ever reach an LLM's own view of "what exists
to place." `listAiExposedComponents(registry)` returns exactly that subset
today (all 7 base entries) - the seam an eventual Ask Alaiy integration
reads from, so an internal/debug/half-finished component can exist in the
registry (resolvable, testable) without ever being offered to the AI.
