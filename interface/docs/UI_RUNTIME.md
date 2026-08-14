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

Two real pages prove it: `/os/dashboard` and `/os/customers` - real Frappe
data, composed from a UI Definition instead of hardcoded JSX. **Neither has
its own `page.tsx`** - both resolve through the one dynamic route every
other `/os/<id>` uses, `src/app/(platform)/os/[...page]/page.tsx`.

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
├── component-registry.ts     baseComponentRegistry, mergeRegistries, resolveComponent
├── layout.ts                 gridColsClasses/spanClasses/isValidSpanValue/isValidGridColumnsValue
├── layout-registry.ts        layoutRegistry, resolveLayout
├── mutations.ts               applyUIAction (ADD/REMOVE/MOVE/UPDATE_COMPONENT)
├── node.ts                    isLayoutNode/isComponentNode
├── validate.ts                validatePageConfig, findDuplicateIds (structural validation)
├── validate-against-registry.ts   registry-aware validation (see below)
├── page-features.tsx          pageFeatures render-override map (empty today)
├── resolve-page.tsx           the one pipeline every route calls
├── data/
│   ├── registry.ts            Data Source Registry (registerDataSource/getDataSource/listDataSources)
│   ├── resolver.ts             resolvePageData - walks a definition, resolves referenced sources in parallel
│   ├── resolve-data-source.ts  DataSourceRef resolution (dot-path getter)
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
├── page.ts         UIPageDefinition
├── page-config.ts   PageConfigFile, ValidationResult
├── page-features.ts PageFeatureBinding
├── actions.ts       UIAction
├── data-source.ts   DataSourceFieldType/Field/Context/Capabilities/Definition
├── data-source-ref.ts  DataSourceRef
├── layout.ts        Breakpoint, ResponsiveValue
├── registry.ts      ComponentCapabilities, ComponentRegistryEntry, ComponentRegistry
├── validation.ts    ValidateAgainstRegistryOptions
└── store.ts         UIPageStore, SidebarStore interfaces

src/config/
├── page-schema.ts    the zod schemas validate.ts checks a definition against (structural)
├── component-props-schema.ts  per-type propsSchema zod objects (registry-aware, see below)
├── layout-classes.ts  GRID_COLS_CLASSES/SPAN_CLASSES Tailwind lookup tables
├── kpi-icons.ts        curated icon-name ↔ LucideIcon map for os-kpi (KPI_ICONS, KPI_ICON_NAMES)
├── kpi-classes.ts      KPI_BORDER_TONES + KPI_BORDER_TONE_CLASSES for os-kpi's accent bar
├── nav-icons.ts        curated icon-name ↔ LucideIcon map for the sidebar
└── contributed-nav.ts  composer-generated connector nav contributions (unchanged contract)

src/seeds/
├── pages/seed-data.ts    HEADLESS_DASHBOARD_PAGE, HEADLESS_CUSTOMERS_PAGE, SEED_PAGES
├── sidebar/seed-data.ts  buildCodeDefinedSidebar() - base groups + contributedNav merge
└── seed-headless-db.ts   dev script: deletes the sqlite file to force a reseed

src/tests/runtime/        every runtime test, mirroring the file map above
src/tests/config/         config-level tests (e.g. nav-icons)

src/components/
├── registry/          the actual React components the Component Registry points at:
│                       card.tsx, chart.tsx, filter-bar.tsx, kpi.tsx, page-header.tsx,
│                       period-toggle.tsx, stat-card.tsx, data-table/ (data-table.tsx,
│                       data-table-view.tsx, column-spec.tsx, apply-filters.ts)
└── layout/             coming-soon.tsx, invalid-page-config.tsx (the two render fallbacks),
                        sidebar/ (app-sidebar.tsx, settings-sidebar.tsx), nav-main.tsx
```

Why this split, concretely: `runtime/component-registry.ts` imports real
React components from `@/components/registry/*` and assembles
`baseComponentRegistry` - that assembly, and `resolveComponent`, are logic,
so they stay in `runtime/`. The *shape* of a registry entry
(`ComponentRegistryEntry`) is a pure type with no behavior, so it lives in
`types/runtime/registry.ts` instead of being declared inline. Same pattern
throughout: `runtime/layout.ts`'s functions stay, the Tailwind class tables
they read from moved to `config/layout-classes.ts`; `runtime/validate.ts`'s
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

Accessed only through `SidebarStore` (`types/runtime/store.ts`, one method:
`getSidebarNav()`), implemented by `SQLiteSidebarStore`
(`runtime/store/sqlite-sidebar-store.ts`) - same shape as
`UIPageStore`/`SQLiteUIPageStore`, singleton getter included.

**Unlike `ui_pages`'s seed-once `ensureSeeded`**, `source = 'code'` rows are
deleted and reinserted on *every* store construction
(`syncCodeDefinedSidebar`), from `seeds/sidebar/seed-data.ts`'s
`buildCodeDefinedSidebar()` - the base's own groups
(Catalog/Sales/Procurement/Inventory/...) and connector contributions
(`config/contributed-nav.ts`, unchanged - see
`docs/CONNECTOR_TO_BASE_UI_COMPOSITION.md` §16) are still code-owned config,
and a redeploy that changes either must take effect without a manual reseed
step. `source = 'dynamic'` rows are never touched by that sync - the seam a
future page-creation flow (Ask Alaiy or otherwise) would write through,
optionally pointing `page_id` at a `ui_pages` row so a nav entry can be
traced back to the page it links to. No such flow is implemented yet; the
schema just leaves room for it.

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
existing Frappe BFF (`src/lib/frappe/`):

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

## The Component Registry: a machine-readable contract

Every component lives in one base registry (`runtime/component-registry.ts`)
- nothing is feature-specific, because `columns`/`series`/`filters` are all
plain, JSON-safe declarative specs rather than React code:

| type | component | contract |
|---|---|---|
| `os-page-header` | `PageHeader` | title/subtitle/action slot (pre-existing) |
| `os-card` | `OsCard` | generic chrome wrapper |
| `os-kpi` | `OsKpi` | `value`, `format`/`currency`/`precision`, `trend`/`trendUnit`/`trendPolarity`, `borderTone` |
| `os-chart` | `OsChart` | `x`, `series: {field,label,type:"bar"|"line"|"area"}[]`, `legend`, `rows` |
| `os-data-table` | `OsDataTableView` | `columns: {field,label,format,align,sortable,filterable,badgeTones}[]`, `rows`, search/filter/columnVisibility/selectable/paginated |
| `os-filter-bar` | `OsFilterBar` | `filters: {id,type:"select"|"text"|"date-range",label,searchParam,options,defaultValue}[]` |
| `os-period-toggle` | `OSPeriodToggle` | pre-existing, `?period=` only |

Every entry (`types/runtime/registry.ts`'s `ComponentRegistryEntry`) also
declares:

```ts
{
  capabilities: { movable?: boolean; resizable?: boolean };
  allowedParents: (LayoutType | ComponentType)[]; // e.g. ["grid", "stack", "section"]
  supportsChildren: boolean;
  requiredFields?: string[]; // e.g. os-kpi: ["title", "value"]
  propsSchema?: ZodTypeAny; // per-type shape check on literal `props` (config/component-props-schema.ts)
}
```

`capabilities`/`allowedParents`/`supportsChildren`/`requiredFields`/
`propsSchema` are all optional on the *type* (so a minimal ad hoc override -
a test fixture, an early feature-specific entry - still type-checks), but
every real entry in `baseComponentRegistry` populates them.

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
`runtime/validate-against-registry.ts` (next section) - not by the renderer,
and not by `runtime/mutations.ts`. `ADD_COMPONENT`/`MOVE_COMPONENT` still
only check "is the parent a layout node at all," a deliberate v1
simplification predating this contract (see that file's module doc) - using
the finer-grained `allowedParents` there too would be a natural next step.

## A second validation pass: `runtime/validate-against-registry.ts`

`runtime/validate.ts` is deliberately *structural only* - it checks a
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
regression test (`tests/runtime/validate-against-registry.seed.test.ts`) that
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
src/app/(platform)/os/[...page]/page.tsx  - anything else under /os with no static route,
                                            including /os/dashboard and /os/customers
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
