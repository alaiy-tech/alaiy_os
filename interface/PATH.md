# Routes

Every URL the `interface` Next.js app serves, and what sits behind it.

The source of truth is the App Router tree under `src/app` — a `page.tsx`
is a rendered page, a `route.ts` is a handler that returns a redirect or a
proxied response. Directories in parentheses (`(main)`) are route groups and
directories with a leading underscore (`_components`) are private, so neither
appears in a URL. Two things live outside that tree and are listed further
down: the redirects declared in `next.config.mjs`, and the session gate in
`src/proxy.ts`.

Legend: `→` redirect target · `[id]` dynamic segment · `[...path]` catch-all ·
`↻` proxied to Frappe.

## Tree

```
/                                             → /os
│
├── /auth
│   ├── /auth/login                           sign-in form (?next= preserved)
│   └── /auth/expired                         → /auth/login, clearing a dead session cookie
│
├── /unauthorized                             "no permission" screen
│
├── /os                                       dashboard — KPIs, sales trend, stock mix, recent orders
│   │                                         ?period=1D|1W|1M|1Y  ?channel=<sales channel>
│   ├── /os/ask-alaiy                         Ask Alaiy chat
│   │
│   ├── /os/products                          item catalog + product KPIs   ?period=
│   ├── /os/item-groups                       catalog category hierarchy
│   ├── /os/item-attributes                   variant attributes and their allowed values
│   ├── /os/customers                         customer metrics and performance overview
│   │
│   ├── /os/sales
│   │   └── /os/sales/orders                  Sales Order list
│   │       └── /os/sales/orders/new          → Frappe desk /app/sales-order/new
│   │
│   ├── /os/procurement
│   │   └── /os/procurement/purchase-orders   Purchase Order list
│   │       ├── .../new                       → Frappe desk /app/purchase-order/new
│   │       └── .../[id]                      Purchase Order detail — lines, totals,
│   │                                         linked receipts and invoices (404 if unknown)
│   │
│   ├── /os/settings
│   │   ├── /os/settings/organisation         company profile
│   │   ├── /os/settings/users                users
│   │   ├── /os/settings/roles                roles and permissions
│   │   └── /os/settings/themes               theme and appearance
│   │
│   └── /os/<anything else>                   catch-all: "This section will be added in
│                                             future updates", inside the dashboard shell
│
├── /api                                      ↻ Frappe HTTP API (GET POST PUT PATCH DELETE)
│   ├── /api/method/[...path]                 ↻ whitelisted methods
│   │                                            e.g. /api/method/alaiy_os.api.chat.send_message
│   └── /api/resource/[...path]               ↻ document REST API
│                                                e.g. /api/resource/Item/ITEM-0001
│
├── /files/[...path]                          ↻ public files (GET) — Item images, user avatars
└── /private/files/[...path]                  ↻ private files (GET) — permission-checked by Frappe
```

## Redirects

Declared in `next.config.mjs` (temporary, so bookmarks keep working without
being cached permanently):

| From | To |
| --- | --- |
| `/os/dashboard` | `/os` |
| `/os/sales-orders` | `/os/sales/orders` |
| `/os/purchase-orders` | `/os/procurement/purchase-orders` |

`/` redirects to `/os` from `src/app/page.tsx` rather than from the config, and
`/os/sales/orders/new` and `/os/procurement/purchase-orders/new` redirect out to
the Frappe desk from route handlers — the bench URL is server-only config, so
resolving it on the server keeps the Frappe origin out of the client bundle.

## Who can reach what

`src/proxy.ts` runs before the matched requests complete, with
`matcher: ["/os/:path*", "/auth/login"]`:

- `/os/**` without a Frappe session → `/auth/login?next=<path>`
- `/auth/login` with a session → `/os`
- everything else is untouched, which is why `/auth/expired`, `/unauthorized`,
  `/api/**` and the file routes are reachable while signed out (the `/api` and
  file routes still carry the caller's cookies to Frappe, so Frappe enforces
  access on them).

That check only reads the `sid` cookie. The authoritative check is
`getServerUser()` in the `/os` layout, and a cookie Frappe has since disowned
is what `/auth/expired` exists to resolve — it clears the session cookies so
the two checks can stop disagreeing and looping.

## Paths the sidebar links to that have no page yet

`src/config/sidebar-config.ts` lists these; each currently lands on the
`/os/**` catch-all:

```
/os/brands                /os/suppliers              /os/warehouses
/os/item-prices           /os/supplier-groups        /os/stock-entries
/os/pricing-rules         /os/purchase-receipts      /os/stock-ledger
/os/sales-invoices        /os/purchase-invoices      /os/stock-reconciliation
/os/customer-groups                                  /os/settings/logs
```

A composed deployment can add more entries, and whole new groups, through the
generated `src/config/contributed-nav.ts` — those paths are owned by the
contributing app, not by this list.

## Adding a route

Add a `page.tsx` under `src/app/(main)/os/<segment>/` and, if it belongs in the
navigation, an entry in `src/config/sidebar-config.ts`. Give a list route a
`*_BASE_PATH` constant under `src/constants/` (as
`PURCHASE_ORDER_BASE_PATH` does) so links and `notFound()` fallbacks share one
literal. A static segment beats a dynamic sibling in Next's router, which is
what lets `/…/new` sit next to `/…/[id]` — Frappe docnames are
series-generated (`SAL-ORD-…`), so nothing real is shadowed. Then update this
file.
