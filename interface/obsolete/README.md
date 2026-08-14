# obsolete/

Code superseded by the Round 4 refactor of the Headless OS runtime, kept as
a recovery/reference point rather than deleted outright. Everything here was
confirmed - not assumed - to be unused by any retained route or component
before it was moved (full audit trail in the conversation that produced this
refactor; see `docs/UI_RUNTIME.md` for the current architecture).

**Not part of the build or test suite** - excluded from `tsconfig.json`,
`biome.json`, and `vitest.config.ts`. Nothing here is type-checked, linted,
or executed.

```
obsolete/
├── pages/os/       The six removed /os/* route trees (customers, products,
│                   sales/orders, procurement/purchase-orders,
│                   item-attributes, item-groups) plus the now-orphaned
│                   os/open/[doctype]/[name] redirect route, and the old
│                   standalone os/headless/page.tsx (now served by
│                   os/headless/[[...page]] instead).
├── features/       The old features/dashboard/ and features/customers/
│                   folders - superseded once os-data-table/os-chart/os-kpi
│                   became generic, declarative-config components with
│                   nothing left to be "feature-specific" about.
├── data/           lib/frappe/* fetchers, types, constants, and config
│                   files that only ever backed the removed pages above.
├── store/          Round 3's JsonFilePageStore (a working, alternative
│                   UIPageStore implementation, not broken code) and its
│                   test - superseded by SQLiteUIPageStore.
├── ui-config/      The two JSON page definitions JsonFilePageStore used to
│                   read - now seeded into SQLite instead, in a rewritten,
│                   declarative shape (see store/seed-data.ts).
└── headless-page.tsx.bak
```

If something here turns out to still be needed, that's a sign the audit
missed a dependency - restore the specific file, don't restore the whole
directory wholesale.

## Round 5: `/os/headless` retired, dashboard promoted to `/os/dashboard`

`/os/headless` was always a test route proving the UI runtime against a real
page before trusting it with the real dashboard - once that was proven (two
real pages, the registry contract, validation), keeping a parallel test
surface around stopped serving a purpose. The dashboard and customers pages
are now the only `/os/dashboard` and `/os/customers`, served by the same
generic `os/[...page]` catch-all every other page uses - no dedicated
`page.tsx`, no separate optional catch-all route.

```
obsolete/
├── pages/os/dashboard/    The old hardcoded `/os` dashboard (page.tsx +
│                          _components/) - superseded by the DB-driven
│                          definition now seeded at id "dashboard",
│                          route /os/dashboard (seeds/pages/seed-data.ts).
├── ui-runtime/dev/        headless-mutation-demo.tsx - the dev-only
│                          Hide-sales-chart/Move-Recent-Orders proof that
│                          applyUIAction works, retired now that its page is
│                          a real production route, not a test one.
└── config/                sidebar-config.ts - the old hardcoded `/os/*`
                            sidebar, superseded by seeds/sidebar/seed-data.ts +
                            runtime/store/sqlite-sidebar-store.ts (the
                            sidebar is now database-driven; see
                            docs/UI_RUNTIME.md).
```

## Round 6: `ui-runtime/` renamed to `runtime/`, types/constants/config extracted

The runtime's own internal organization was flattened and its pure type
declarations, constants, and zod schemas pulled out into `src/types/runtime/`,
`src/config/`, and `src/seeds/` respectively - `runtime/` (renamed from
`ui-runtime/`) now holds only logic (functions, classes, registries that
hold real component references), not type-only files or plain data tables.
Nothing from this round moved to `obsolete/` - it was a live reorganization,
not a retirement - see `docs/UI_RUNTIME.md` for the current file map.

## Round 7: `src/lib/` audit - types/constants extracted, one dead helper retired

The same types/constants/config discipline Round 6 applied to `runtime/`,
applied to `src/lib/`: every pure type moved to `src/types/`, every plain
constant/lookup table moved to `src/constants/` or `src/config/` (fonts,
theme presets, layout-preference options, connector/user/organisation/log
types), `CompanyInfo` deduplicated from two independent declarations into
one (`types/company.ts`), and `formatCurrency` joined `lib/format.ts`'s
other value formatters instead of sitting in the generic `lib/utils.ts`.
`lib/logs.ts`'s page-specific formatting functions moved to
`components/baseline/settings/logs/log-formatting.ts`, next to their only
callers, rather than living in the generic `lib/` folder under a name that
collided with the unrelated `lib/frappe/logs.ts` data-fetching module.

```
obsolete/data/lib/dates.ts   isPastDue - confirmed dead in the live tree (zero
                             callers), but still the base helper
                             isDeliveryPastDue/isReceiptPastDue
                             (obsolete/data/lib/sales-orders.ts,
                             purchase-orders.ts) call - moved here alongside
                             them rather than deleted outright, since it was
                             a Round 4 casualty the sweep at the time missed,
                             not new dead code.
```
