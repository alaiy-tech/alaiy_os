# Routes

Every URL the `interface` Next.js app serves, and what sits behind it.

The source of truth is the App Router tree under `src/app` — a `page.tsx`
is a rendered page, a `route.ts` is a handler that returns a redirect or a
proxied response. Directories in parentheses (`(platform)`) are route groups and
directories with a leading underscore (`_components`) are private, so neither
appears in a URL. Two things live outside that tree and are listed further
down: the redirects declared in `next.config.mjs`, and the session gate in
`src/proxy.ts`.

Legend: `→` redirect target · `[id]` dynamic segment · `[...path]` catch-all ·
`[[...path]]` *optional* catch-all (also matches its own parent route with
zero extra segments) · `↻` proxied to Frappe.

## Baseline vs. dynamic routes

Since the Round 4 Headless OS refactor, `/os/*` splits into two kinds:

- **Baseline (platform-owned, source-defined)**: `/os/ask-alaiy` - a real
  `page.tsx`, unchanged by anything below.
- **Dynamic (config-driven)**: everything else, including `/os/dashboard`
  and `/os/customers` — every `/os/<id>` resolves through
  `src/app/(platform)/os/[...page]/page.tsx`, calling `resolvePage()`
  (`src/runtime/resolve-page.tsx`) against the local SQLite `UIPageStore`
  - see `docs/UI_RUNTIME.md`. Next's router always prefers a more specific
  static route over the catch-all, so baseline routes need no special-casing.

`/os/headless` and `/os/headless/customers` (a test route proving the UI
runtime against a real page before promoting it) are gone as of Round 5 -
the dashboard and customers pages are real production routes now,
`/os/dashboard` and `/os/customers`, with no separate test surface. See
`obsolete/README.md`'s "Round 5" section.

`/settings/*` is a **separate top-level route group** (`src/app/(platform)/settings/`,
not nested under `/os`), with its own fixed, code-owned sidebar - see
"Settings" below.

## Tree

```
/                                             → /os/dashboard
│
├── /auth
│   ├── /auth/login                           sign-in form (?next= preserved)
│   └── /auth/expired                         → /auth/login, clearing a dead session cookie
│
├── /unauthorized                             "no permission" screen
│
├── /os                                       → /os/dashboard
│   ├── /os/dashboard                         dashboard — KPIs, sales trend, stock mix, recent
│   │                                         orders; config-driven (id "dashboard" in ui_pages)
│   │                                         ?period=1D|1W|1M|1Y
│   ├── /os/ask-alaiy                         Ask Alaiy chat
│   ├── /os/customers                         config-driven (id "customers" in ui_pages)
│   │
│   └── /os/<anything else>                   dynamic: resolves a SQLite-stored UI Definition if
│                                             one exists at this id; otherwise the same "This
│                                             section will be added in future updates" catch-all
│                                             as before, inside the dashboard shell
│
├── /settings                                 → /settings/organisation; own sidebar, own layout
│   ├── /settings/organisation                company profile
│   ├── /settings/users                       users
│   ├── /settings/permissions                 roles and permissions
│   ├── /settings/connectors                  every row in OS Connector Registry
│   │   └── /settings/connectors/[connector_id]   a connector's own settings screen (ships with
│   │                                              that connector's app - see
│   │                                              CONNECTOR_TO_BASE_UI_COMPOSITION.md §16.1)
│   ├── /settings/themes                      theme and appearance
│   └── /settings/logs                        what installed apps recorded calling out;
│                                             one source per alaiy_os_sidebar_log_items entry
│
├── /api                                      ↻ Frappe HTTP API (GET POST PUT PATCH DELETE)
│   ├── /api/method/[...path]                 ↻ whitelisted methods
│   │                                            e.g. /api/method/alaiy_os.api.chat.send_message
│   └── /api/resource/[...path]               ↻ document REST API
│                                                e.g. /api/resource/Item/ITEM-0001
│
└── /files/[...path]                          ↻ public files (GET) — Item images, user avatars
    /private/files/[...path]                  ↻ private files (GET) — permission-checked by Frappe
```

**Removed in Round 4** (moved to `interface/obsolete/pages/os/`, not deleted
outright - see `obsolete/README.md`): `/os/products` (+ `[id]`),
`/os/item-groups`, `/os/item-attributes`, `/os/customers` (the old hardcoded
version - the name is back today as the config-driven replacement above),
`/os/sales/orders` (+ `[id]`, `new`, `[id]/print`),
`/os/procurement/purchase-orders` (+ `[id]`, `new`), and the
`/os/open/[doctype]/[name]` Frappe-desk redirect those detail pages were the
only linkers of. Each now falls through to the same dynamic `/os/[...page]`
catch-all every other not-yet-built path already used.

**Removed/moved in Round 5** (see `obsolete/README.md`'s "Round 5" section):
the old hardcoded `/os` dashboard (`page.tsx`), `/os/headless` and
`/os/headless/customers` (the test route both were promoted from), and
`/os/settings/*` (moved to the top-level `/settings/*` above - a connector's
per-`connector_id` settings screen address also moved,
`/os/settings/connectors/<id>` → `/settings/connectors/<id>`).

## Redirects

Declared in `next.config.mjs` (temporary, so bookmarks keep working without
being cached permanently):

| From | To |
| --- | --- |
| `/os` | `/os/dashboard` |
| `/settings` | `/settings/organisation` |
| `/os/sales-orders` | `/os/sales/orders` (now the dynamic catch-all's "coming soon" state - the target page was removed) |
| `/os/purchase-orders` | `/os/procurement/purchase-orders` (same) |

`/` redirects to `/os` from `src/app/page.tsx` rather than from the config,
which the `/os` → `/os/dashboard` entry above then carries the rest of the way.

## Who can reach what

`src/proxy.ts` runs before the matched requests complete, with
`matcher: ["/os/:path*", "/settings/:path*", "/auth/login", "/headless-os.sqlite"]`:

- `/headless-os.sqlite` → always a bare 404, regardless of auth state - the
  Headless OS runtime database lives under `public/` (see
  `docs/UI_RUNTIME.md`) but must never be directly downloadable.
- `/os/**` or `/settings/**` without a Frappe session → `/auth/login?next=<path>`
- `/auth/login` with a session → `/os` (which itself redirects to `/os/dashboard`)
- everything else is untouched, which is why `/auth/expired`, `/unauthorized`,
  `/api/**` and the file routes are reachable while signed out (the `/api` and
  file routes still carry the caller's cookies to Frappe, so Frappe enforces
  access on them).

That check only reads the `sid` cookie. The authoritative check is
`getServerUser()` in the `/os` and `/settings` layouts, and a cookie Frappe
has since disowned is what `/auth/expired` exists to resolve — it clears the
session cookies so the two checks can stop disagreeing and looping.

## The `/os/*` sidebar is database-driven (Round 5)

Unlike Settings' fixed sidebar (below), the `/os/*` sidebar's groups and
items are read from the same local SQLite database as `ui_pages`, via
`src/runtime/store/sqlite-sidebar-store.ts` - see `docs/UI_RUNTIME.md`
for the schema and how it stays in sync with code (`src/seeds/sidebar/seed-data.ts`)
and connector contributions (`src/config/contributed-nav.ts`). The paths
below are still config-driven placeholders with no page behind them yet;
each currently lands on the dynamic `/os/**` catch-all's "coming soon" state:

```
/os/brands                /os/suppliers              /os/warehouses
/os/item-prices           /os/supplier-groups        /os/stock-entries
/os/pricing-rules         /os/purchase-receipts      /os/stock-ledger
/os/sales-invoices        /os/purchase-invoices      /os/stock-reconciliation
/os/customer-groups       /os/products               /os/item-groups
/os/item-attributes       /os/sales/orders           /os/procurement/purchase-orders
```

A composed deployment can add more entries, and whole new groups, through the
generated `src/config/contributed-nav.ts` — those paths are owned by the
contributing app, not by this list. A connector's contribution is folded
into the sidebar database on every app start (`syncCodeDefinedSidebar`), so
a redeploy that adds a new connector needs no manual reseed step.

## Settings' sidebar is fixed, not database-driven

`/settings/*`'s sidebar (`src/components/layout/sidebar/settings-sidebar.tsx`)
is a baseline UI layout thing, per the same reasoning as `/os/ask-alaiy`
being source-defined: its 7 items (Back to OS, Organisation, Users, Roles
and Permissions, Connectors, Themes, Logs) are fixed in code, not read from
the database. Reached via a "Settings" entry in the main `/os/*` sidebar's
account menu (`src/components/menu/nav-user-menu.tsx`), not a sidebar group.

## Adding a route

**Config-driven (preferred for anything under `/os` that isn't platform
shell/auth)**: insert a row into the local `ui_pages` SQLite table (see
`docs/UI_RUNTIME.md` - today that means adding to
`src/seeds/pages/seed-data.ts` and running `npm run seed:headless-db`;
there is no admin UI yet). No `page.tsx` required - it resolves through the
existing `/os/[...page]` catch-all automatically. If the route needs live
data, register a Data Source (`src/runtime/data/sources/`) rather than
writing a page-specific fetcher. If it belongs in the sidebar, add it to
`src/seeds/sidebar/seed-data.ts`'s `baseSidebarGroups` (or, for a connector, that
app's `interface.config.json` `nav` block).

**Source-defined (baseline/platform routes only)**: add a `page.tsx` under
`src/app/(platform)/os/<segment>/` (or `src/app/(platform)/settings/<segment>/` for
a settings screen, updating `settings-sidebar.tsx`'s fixed list too). A
static segment beats a dynamic sibling in Next's router, which is what lets
a static route sit next to the catch-all without being shadowed. Then update
this file.
