# Alaiy OS — Headless UI Revamp

A high-level orientation for anyone touching this work. For schemas,
registry contracts, file structure, and implementation detail, read
[`UI_RUNTIME.md`](./UI_RUNTIME.md) — this doc is intentionally the "read
once before you start" version.

## 1. What we're building

Alaiy OS is moving from **hardcoded Next.js pages** to a **configurable UI
platform**:

```text
Today:      Next.js Page → React Components → Frappe BFF → ERPNext
Now:        UI Definition → Headless Runtime → Existing React Components → Frappe BFF → ERPNext
Eventually: User → Ask Alaiy → Structured UI Actions → UI Definition → Runtime → Existing React UI
```

The goal: users can eventually change their Alaiy OS UI through Ask Alaiy,
without us generating or executing arbitrary React code.

## 2. What "Headless" means here

We are **not** removing Next.js, React, Tailwind, shadcn, existing
components, or the Frappe BFF. What changes is *how a page's structure is
described* — as data, not hardcoded JSX:

```text
Page
 ├── Header
 ├── KPI
 ├── KPI
 ├── Chart
 └── Table
```

The runtime reads that definition and renders the same React components a
hardcoded page would have used.

## 3. The core architectural principle

**AI modifies a UI definition. It never writes or executes React code.**

```text
Ask Alaiy → Structured UI Actions → Validate → Modify UI Definition → Render
```

"Remove the sales chart" becomes `REMOVE_COMPONENT("sales-overview-chart")`,
applied to the page definition. This gives us a closed, safe vocabulary
instead of an LLM generating TSX.

## 4. Current state (this is real, not a POC anymore)

Two production pages already run entirely on the runtime — **`/os` (the
dashboard) and `/os/customers`**, using real Frappe data, the same
components the hardcoded versions used. `/os/customers` resolves through
the generic catch-all (`src/app/(platform)/os/[...page]/page.tsx`); the
dashboard has its own thin `src/app/(platform)/os/page.tsx` (bare `/os` has
no segments for that catch-all to match), which just hardcodes
`resolvePage("dashboard", ...)` - not a second rendering path.

There is no more `/os/headless` test route — that was step one, proving the
runtime against a real page before trusting it with the actual dashboard.
Once proven, it was retired; the dashboard and customers pages are simply
the real thing now (old hardcoded versions kept in `obsolete/` as reference).

Also live today:
- **The `/os/*` sidebar is database-driven** (SQLite-backed, same file as
  page definitions), merged with connector-contributed nav on every app
  start. The code-owned baseline is deliberately minimal (OS → Ask Alaiy,
  plus a Settings button); every page gets its own sidebar entry
  automatically under "Uncategorised" when created
  (`createPageWithSidebarEntry`), and each connector's pages group under a
  fixed "Connectors" section. Settings has its own fixed sidebar and lives
  at a separate `/settings/*` route.
- **User preferences (theme, layout, sidebar variant, ...) are database-driven
  too** — one shared row per key in the same SQLite file, not per-user or a
  cookie of record. Cookies/localStorage still exist, but only as a
  synchronous client-side cache for the pre-hydration boot script that
  avoids a flash of unstyled theme; the database is the source of truth.
- **Validation runs on every request**: structural (is this well-formed
  JSON?) and registry-aware (unknown types, illegal parent/child placement,
  missing required fields, bad data bindings, invalid grid spans) — a bad
  definition degrades to a controlled error screen, never a stack trace.
- **All four mutation actions are proven**: `ADD_COMPONENT`,
  `REMOVE_COMPONENT`, `MOVE_COMPONENT`, `UPDATE_COMPONENT` — pure, immutable,
  fully unit-tested (same-parent reorders, cross-parent moves, cycle
  rejection, sibling-identity preservation). Nothing calls them in the
  running app yet; that's what Ask Alaiy will eventually do.

## 5. Runtime structure

```text
src/runtime/         behavior only — functions, classes, registries holding real components
├── layout.ts, mutations.ts (applyUIAction), node.ts
├── resolve-page.tsx, page-features.tsx, ui-renderer.tsx
├── registry/        component-registry.ts, layout-registry.ts — "what can render as what"
├── validate/        validate.ts (structural), validate-against-registry.ts (registry-aware)
├── data/            Data Source Registry + resolver + sources/{dashboard,customers}.ts
└── store/           SQLite stores (pages, sidebar, preferences) + the client auth/company/preferences providers

src/types/runtime/   every pure type/interface the runtime uses — zero logic
src/config/          zod schemas, Tailwind class tables, icon maps, contributed-nav
src/seeds/           the two real pages' definitions + the sidebar's base groups
src/tests/runtime/   tests, mirroring the structure above
```

**A rule worth internalizing**: a file under `runtime/` that has no
executable logic — just a type or a plain lookup table — should move to
`types/`, `config/`, or `seeds/`. `runtime/` is for behavior; those folders
are for the shapes and data behavior operates on.

## 6. Keep the runtime generic

`runtime/` must never special-case a domain:

```ts
// Never this, in runtime/:
if (component.type === "customer-list") { ... }
```

Business/domain specifics belong in `src/lib/frappe/` (data fetchers) and
`src/components/registry/` (the actual React components) — the runtime only
ever sees declarative specs (`columns`, `series`, `filters`), never
per-feature code. This is *already true* today: there is no per-page
registry, no `features/` folder, and the two real pages (dashboard,
customers) share one base `ComponentRegistry`.

## 7. Component Registry

A stable, machine-readable contract per component
(`types/runtime/registry.ts`):

```ts
{
  type: "os-kpi",
  name: "KPI",
  description: "...",
  category: "data-display",
  ai: { exposed: true },
  capabilities: { movable: true, resizable: true },
  allowedParents: ["grid", "stack", "section"],
  supportsChildren: false,
  requiredFields: ["title", "value"],
  propsSchema: OS_KPI_PROPS_SCHEMA, // config/component-props-schema.ts
}
```

This is what makes the registry usable by an AI later — it's not just
"here's a component," it's "here's what you're allowed to do with it," and
`ai.exposed` is the final gate: only entries marked exposed (all 7 base
components today, via `listAiExposedComponents`) are ever offered to Ask
Alaiy — a component can be registered and renderable without being
AI-exposed. A connector can contribute additional entries at build time
through the `components` extension point
(`config/contributed-components.ts`, merged via `mergeRegistries` in
`resolve-page.tsx`) — see
[`CONNECTOR_TO_BASE_UI_COMPOSITION.md`](./CONNECTOR_TO_BASE_UI_COMPOSITION.md) §16.1.
`requiredFields` says which fields a component can't render without;
`propsSchema` (a zod object per type) says what shape each literal prop must
have if present at all - an unrecognised icon name or a stray prop key fails
validation instead of silently doing nothing.

Semantic components today: `os-page-header`, `os-card`, `os-kpi`,
`os-chart`, `os-data-table`, `os-filter-bar`, `os-period-toggle`. shadcn/base
primitives (`Button`, `Popover`, `Dialog`, ...) remain internal building
blocks the AI never reasons about directly.

## 8. Layout is a tree, not a canvas

```text
Page
 ├── Section
 │    └── Grid
 │         ├── KPI
 │         └── Chart
 └── Section
      └── DataTable
```

Layout primitives today: `Section`, `Stack`, `Inline`, `Grid`. Spans are
responsive (`{ base: 1, md: 6, xl: 4 }`), resolved against a small closed set
of Tailwind classes (`config/layout-classes.ts`) — never pixel coordinates.

## 9. Data stays separate from UI, and reuses the existing BFF

A UI definition never contains business data — only a `source` id
(`{ source: "customers" }`). The Data Source Registry
(`runtime/data/registry.ts`) maps that id to a `resolve()` that calls an
*existing, unmodified* `src/lib/frappe/*.server.ts` fetcher. No second
backend, no new API client.

## 10. Build-time vs. runtime customization — both are real, don't confuse them

```text
Build-time: Connector → interface.config.json / @alaiy-os/* → composed into the app
Runtime:    Existing application → Headless UI Definition → runtime customization
```

The existing composition system (`interface.config.json`, `@alaiy-os/*`
aliases, contributed nav, connector/client routes — see
`CONNECTOR_TO_BASE_UI_COMPOSITION.md`) is **live architecture, not
replaced**. It creates the application. Headless UI customizes that
application's UI afterward. Don't conflate the two.

## 11. Persistence: planned, not built

Today's two real pages are seeded from TypeScript into SQLite
(`seeds/seed.ts`) — a developer-owned artifact, not yet
user-editable storage. The next real step (not started) is Frappe-backed
persistence:

```text
OS UI Page (current version, route, scope)
OS UI Page Version (an immutable snapshot — history, rollback)
OS UI Change (who changed what, which version it produced — audit, preview)
```

This doesn't replace the `UIPageStore`/`SidebarStore` interfaces — a future
`FrappePageStore` implements them the same way `SQLiteUIPageStore` does now.
Nothing above that interface changes.

## 12. Sequencing — where Ask Alaiy fits

```text
Runtime (done) → Real pages (done) → Validation (done) → Persistence (Frappe) →
Versioning → Preview/Rollback → Ask Alaiy read access → Ask Alaiy UI actions → AI-generated pages
```

We do not start by connecting the LLM. The runtime needs to be reliable
before the AI gets permission to touch it.

## 13. What NOT to do

- Don't special-case a domain inside `runtime/`.
- Don't replace shadcn — it's still the low-level foundation.
- Don't build a second Frappe/BFF integration.
- Don't expose shadcn primitives to the AI — only semantic registry
  components.
- Don't build a drag-and-drop page builder before the action/validation
  system is trustworthy.
- Don't let AI write to the store directly once it's wired in — every
  change goes through validate → preview → approve → publish.
- Don't declare a type or constant inline in a `runtime/` file — it belongs
  in `types/`, `config/`, or `seeds/` (see §5).

## 14. A quick checklist when adding something

- **Generic runtime behavior?** → `src/runtime/`
- **A type/interface with no logic?** → `src/types/runtime/`
- **A constant, lookup table, or zod schema?** → `src/config/`
- **Domain/business logic or data fetching?** → `src/lib/frappe/`
- **A real React component the registry points at?** → `src/components/registry/`
- **Something the AI should understand as a unit?** → a semantic Component
  Registry entry, not raw primitives.
- **Changes page composition?** → it should be expressible as a UI
  Definition + action, not a new hardcoded branch.

## For implementation detail

Read [`UI_RUNTIME.md`](./UI_RUNTIME.md) for the actual schemas, registry
contracts, file-by-file structure, and current test coverage. Read
[`CONNECTOR_TO_BASE_UI_COMPOSITION.md`](./CONNECTOR_TO_BASE_UI_COMPOSITION.md)
before touching anything connector/client-facing. Read
[`PATH.md`](./PATH.md) before adding or moving a route.
