# Alaiy OS Dashboard (frontend)

A standalone React SPA for `alaiy_os`, talking to Frappe as a same-origin
REST API. This is **not** the Frappe desk - it's an additive custom
dashboard served at `/os/`. The existing desk customization (custom
sidebar/theme, the desk "Ask Alaiy" page, `/` → `/desk/ask-alaiy`) is
untouched and keeps working as before.

**Design source of truth:** `../mydesign/Alaiy OS Dashboard.dc.html` (an
approved Claude Design prototype, one level up from this folder). Every
color, copy string, and layout number in this app was read directly out of
that file, not eyeballed from a screenshot - see
[`docs/DESIGN_TOKENS.md`](docs/DESIGN_TOKENS.md) for the palette and
[`docs/adding-a-screen.md`](docs/adding-a-screen.md) for how new screens
should keep following it.

Stack: React + TypeScript, Vite, pnpm, TanStack Query, TanStack Table,
`frappe-react-sdk`, shadcn/ui (Tailwind), React Router. Session/cookie auth
against Frappe's own login - no separate token layer. Light mode only, Geist
throughout (the design doesn't use a separate display/serif face).

**shadcn components used, matching the design's own component choices:**
Sidebar (`collapsible="icon"`), Table + TanStack Table, Empty, Command /
CommandDialog, Tabs, Select, Checkbox, Progress, AlertDialog, Dialog, Sheet,
DropdownMenu, Avatar, Badge, Card, Button, Input, Label, Alert, Skeleton,
Separator, Tooltip, Popover.

## Prerequisites

- Node 18+ and pnpm (`corepack enable` or `npm i -g pnpm`)
- A running Frappe bench with the `alaiy_os` app installed, reachable over
  HTTP from wherever you run `pnpm dev` (this repo was built against a bench
  running in WSL, reachable from Windows at `http://vistara-ubuntu-wsl`)

## Local dev

```bash
pnpm install
pnpm dev
```

Opens on `http://localhost:5173`. The dev server proxies `/api`, `/files`,
and `/private` to the real bench (see `vite.config.ts`) so the browser only
ever talks to one origin and the Frappe session cookie lands as same-origin
- no CORS, no separate token layer, matching how production actually works.

If your bench isn't at `http://vistara-ubuntu-wsl`, point the proxy
elsewhere without editing the config:

```bash
VITE_BENCH_URL=http://your-bench-host pnpm dev
```

Log in with a real Frappe user. This pass is read-only (list + detail views,
no create/edit/delete), and reads are plain `GET` requests, which Frappe
doesn't CSRF-protect - so no CSRF token wiring was needed here. **That will
change** the moment a mutation (create/update/delete) is added.

## Production build

```bash
pnpm build
```

This runs `tsc -b && vite build` and writes straight into
`alaiy_os/alaiy_os/www/os/` (outside this folder - see `vite.config.ts`'s
`build.outDir`). Frappe serves that folder directly at `/os/`; no separate
deploy step. After building, restart the bench (or `bench clear-cache`) if
you also changed `hooks.py`'s `website_route_rules`.

The build is committed to the repo alongside the source (matching the
`alaiy_os_thesolist` app's `frontend/` → `www/supplier/` convention) - there's
no CI build pipeline for this app, so `alaiy_os/alaiy_os/www/os/` needs to be
rebuilt and re-committed whenever the source changes.

## Where things live

- `src/config/navigation.ts` - the entire sidebar, as data, lifted from the
  design's `NAV`/`SETTINGS_ITEM` constants. Add an item here and it's
  routable immediately (as Coming Soon, with its assigned T-template, until
  you build it) - see `src/config/templates.ts` for the T1-T10 wireframe copy.
- `src/hooks/use-data-table.ts` + `src/components/data/data-table.tsx`,
  `data-table-column-toggle.tsx`, `data-table-pagination.tsx`,
  `data-table-select-column.tsx` - the generic TanStack-Table-backed list
  primitive every doctype screen plugs into.
- `src/components/data/DetailView.tsx` - the generic detail-screen layout
  primitive (header, stat-card slot, labelled section cards).
- `src/hooks/use-doctype-list.ts` - shared pagination/search/filter state,
  wraps `frappe-react-sdk`'s `useFrappeGetDocList` + `useFrappeGetDocCount`.
- `src/features/<doctype>/` - the three real screens (Item → Products, Sales
  Order, Customer) as the reference pattern.
- `src/components/layout/` - the dashboard shell: collapsible icon-rail
  sidebar, top bar, Ctrl+K command palette, the Ask Alaiy slide-out panel +
  floating handle.
- `src/pages/AskAlaiyPage.tsx`, `src/config/ask-seed.ts` - the Ask Alaiy
  screen. Scripted/seeded, not backend-wired - see "Known limitations" below.
- `alaiy_os/alaiy_os/hooks.py`'s `website_route_rules` - maps deep links
  under `/os/*` back to this app's `index.html` for client-side routing.

See [`docs/adding-a-screen.md`](docs/adding-a-screen.md) for the full
walkthrough of turning a Coming Soon placeholder into a real screen.

## Known limitations of this pass

- Read-only: list + detail only, no create/edit/delete UI yet. Buttons like
  "New item" / "Edit item" render (matching the design) but have no handler.
- Only Products (Item), Sales Order, and Customer are wired to live data;
  everything else in the sidebar is a Coming Soon placeholder showing its
  planned template.
- Several stat/KPI numbers in the design need backend aggregation this pass
  doesn't build (Bin joins, date-range sums, Frappe's version/timeline API).
  Where a real substitute was cheap and honest, that's what's shown instead
  (e.g. Item's stat cards sum real `Bin` rows rather than inventing a
  "valuation" figure). Where it wasn't, the screen says so explicitly
  instead of fabricating a number - see Customer detail's Contacts/Activity
  tabs, and `docs/adding-a-screen.md`'s note on this.
- **The Dashboard is entirely seeded demo data** (matching the design's own
  seed values) - there's no aggregate-analytics backend to wire GMV,
  fulfilment-pipeline, or hourly-intake charts to yet. This is disclosed
  in-app under the page title, not hidden.
- **Ask Alaiy is a scripted UI preview**, not a live agent - same situation
  as the desk's own existing "Ask Alaiy" page stub. Typing a new message
  appends a canned follow-up; nothing is sent anywhere.
- The field lists used in the 3 real screens were chosen from ERPNext's
  standard Item/Sales Order/Customer schema, not introspected from the live
  bench - double-check against **Customize Form** if this bench has any
  custom field renames.
- The production JS bundle is ~670KB (not yet code-split) - fine for this
  pass, worth revisiting with route-level `lazy()` if the app grows.
