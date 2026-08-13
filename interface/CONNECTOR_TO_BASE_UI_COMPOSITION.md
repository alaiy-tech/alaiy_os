# Technical Design — Next.js + Frappe Client Frontend Architecture

## 1. Goals

### We want

* One immutable base Next.js app — `alaiy_os/interface`.
* One Frappe app per client / connector / domain.
* Frappe used only for:

  * Backend APIs
  * DocTypes
  * Database
  * Business logic
  * Connectors
  * Client-specific frontend code
* Client-specific frontend code must **not live inside `alaiy_os/interface`**.
* Client frontend should depend on/import from the base.
* Base should **not know about individual clients**.
* Full Next.js runtime:

  * SSR
  * ISR
  * Server Components
  * Dynamic routes
  * SEO
* Production runs as a Node.js process under PM2.
* No static export.

---

## 1.1 The repos we actually have

| Role | Repo | Frontend contribution lives in |
| --- | --- | --- |
| Base platform | `alaiy-tech/alaiy_os` | `interface/` (this Next.js app) |
| Shared domain app | `alaiy-tech/alaiy_os_commerce` | `interface/` (if/when it ships UI) |
| Connector | `alaiy-tech/alaiy_os_connector_shopify` | `interface/` |
| Connector | `alaiy-tech/alaiy_os_connector_amazon_sp_api` | `interface/` |
| Connector | `alaiy-tech/alaiy_os_connector_nayaglobal` | `interface/` |
| Agent | `alaiy-tech/alaiy_os_agent_amazon_listing` | `interface/` |
| Client | `alaiy-tech/alaiy_os_nayaglobal` | `interface/` |

Two things differ from the naive version of this design, and both matter:

1. **The base is not a standalone repo.** It is the `interface/` directory of the
   `alaiy_os` Frappe app repo, versioned alongside the Python app it talks to
   (`interface/package.json` → `"name": "alaiy-os"`, `"version": "2.2.0"`).
   "Immutable base" therefore means *client code never lands in `alaiy_os/interface`* —
   not that `alaiy_os` is frozen.
2. **Every contributing app uses the same `interface/` name and the same internal
   layout as the base.** A Shopify connector's product-listing screen sits at the
   same relative path its base counterpart would, which is what makes overlay and
   override a single mechanism rather than two.

Locally these are checked out as bare-repo worktrees, so paths in this document
of the form `alaiy_os_connector_shopify/interface/...` correspond on disk to
`repos/alaiy_os_connector_shopify/main/interface/...`.

---

# 2. High-Level Architecture

```text
                         CLIENT DEPLOYMENT
                              │
             ┌────────────────┴────────────────┐
             │                                 │
   alaiy_os/interface (base)          Contributing Frappe App
             │                        (connector / client / agent)
             │                                 │
             │                                 ├── Backend (api/)
             │                                 ├── DocTypes
             │                                 ├── Hooks / patches
             │                                 ├── Connector meta
             │                                 │
             │                                 └── interface/
             │                                      │
             │                                      ├── Routes
             │                                      ├── Pages
             │                                      ├── Components
             │                                      └── Overrides
             │
             └────────────────┬────────────────┘
                              │
                       Build Workspace
                              │
                         next build
                              │
                              ▼
                       Next.js Server
                              │
                             PM2
                              │
                              ▼
                           Browser
```

The important distinction:

```text
alaiy_os/interface
    ↓
immutable

CONTRIBUTING APP
    ↓
provides frontend source

BUILD SYSTEM
    ↓
composes them

NEXT.JS
    ↓
runs normally
```

---

# 3. Dependency Direction

This is the most important architectural rule.

We want:

```text
Contributing App Frontend
       │
       │ imports
       ▼
alaiy_os/interface (base platform)
```

Never:

```text
alaiy_os/interface
       │
       │ imports
       ▼
Contributing App Frontend
```

So the base exposes (see [tsconfig.json](tsconfig.json), where these live
permanently):

```text
@alaiy-os/ui/*        → src/components/ui/*
@alaiy-os/layout/*    → src/components/layout/*
@alaiy-os/list/*      → src/components/list/*
@alaiy-os/menu/*      → src/components/menu/*
@alaiy-os/popover/*   → src/components/popover/*
@alaiy-os/frappe/*    → src/lib/frappe/*
@alaiy-os/hooks/*     → src/hooks/*
@alaiy-os/stores/*    → src/stores/*
@alaiy-os/config/*    → src/config/*
@alaiy-os/types/*     → src/types/*
@alaiy-os/constants/* → src/constants/*
@alaiy-os/utils       → src/lib/utils
```

Client code can then do:

```tsx
import { PageHeader } from "@alaiy-os/layout/page-header";
import { PeriodToggle } from "@alaiy-os/list/period-toggle";
import { fetchItems } from "@alaiy-os/frappe/item-list";
```

Wildcards rather than hand-written barrels, deliberately: a barrel over
`src/components/ui` would be sixty re-exports to keep in sync, would pull every
primitive into any consumer's module graph, and is exactly the shape that trips
`noImportCycles`. This way a contributed import reads one-for-one with the base's
own (`@/components/ui/button` ↔ `@alaiy-os/ui/button`), and the public surface
never has to be enumerated.

But the base never does:

```tsx
import { NayaglobalProductPage } from "@client/alaiy_os_nayaglobal";
```

Note the base's own internal alias stays `@/*` → `./src/*` (see
[tsconfig.json](tsconfig.json)). `@alaiy-os/*` is the *outward* contract for
contributing apps; the two coexist in the composed workspace.

---

# 4. What `alaiy_os/interface` Contains

The base app is essentially the **platform**.

```text
alaiy_os/interface/
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (main)/
│   │   │   ├── auth/login/
│   │   │   ├── unauthorized/
│   │   │   └── os/
│   │   │       ├── layout.tsx
│   │   │       ├── page.tsx              # dashboard
│   │   │       ├── _components/          # dashboard-local components
│   │   │       ├── products/
│   │   │       ├── item-groups/
│   │   │       ├── item-attributes/
│   │   │       ├── customers/
│   │   │       ├── sales-orders/
│   │   │       ├── ask-alaiy/
│   │   │       └── settings/
│   │   └── api/
│   │       ├── method/[...path]/route.ts     # Frappe /api/method proxy
│   │       └── resource/[...path]/route.ts   # Frappe /api/resource proxy
│   │
│   ├── components/
│   │   ├── ui/                # shadcn / base-ui primitives
│   │   ├── layout/            # PageHeader, shells
│   │   ├── list/              # table + period/filter primitives
│   │   ├── menu/  popover/  calendar/  reui/
│   │   └── generic-cell.tsx
│   │
│   ├── lib/
│   │   ├── frappe/            # the data layer (see §17)
│   │   ├── preferences/       # theme + layout preferences
│   │   ├── fonts/
│   │   └── utils.ts
│   │
│   ├── config/                # app-config.ts, sidebar-config.ts
│   ├── navigation/sidebar/
│   ├── hooks/  stores/  types/  constants/  styles/
│   ├── server/server-actions.ts
│   └── proxy.ts               # session gate (Next proxy/middleware)
│
├── next.config.mjs
├── biome.json
├── components.json
├── tsconfig.json
├── package.json
└── ...
```

It contains the default implementation.

For example:

```text
PageHeader
PeriodToggle
ProductKpiCards
DataTable / list primitives
Sidebar + AccountSwitcher
SearchDialog
```

But these are **available to the client**, not imposed upon it.

---

# 5. What the Contributing Frappe App Contains

Example — the Shopify connector:

```text
alaiy_os_connector_shopify/
│
├── alaiy_os_connector_shopify/
│   ├── api/                          # whitelisted methods (sync, test_connection)
│   ├── alaiy_os_connector_shopify/
│   │   ├── doctype/                  # Shopify Connector Settings, Product Listing
│   │   └── page/
│   ├── shopify/                      # SDK / client wrappers
│   ├── connector_meta.py             # registry metadata (see §17)
│   ├── setup/  patches/  public/
│   └── hooks.py
│
└── interface/
    │
    ├── src/
    │   ├── app/(main)/os/
    │   │   ├── settings/connectors/shopify/
    │   │   │   └── page.tsx
    │   │   └── channels/shopify/listings/
    │   │       └── page.tsx
    │   │
    │   ├── components/
    │   │   ├── shopify-sync-panel.tsx
    │   │   └── listing-status-badge.tsx
    │   │
    │   ├── lib/frappe/
    │   │   └── shopify-sync.ts
    │   │
    │   └── overrides/
    │       └── ...
    │
    ├── interface.config.ts
    └── package.json
```

And a client app — Nayaglobal:

```text
alaiy_os_nayaglobal/
│
├── alaiy_os_nayaglobal/
│   ├── api/  client/  pricing/  payments/  jobs/
│   ├── constants/  setup/  patches/  migrate/
│   └── hooks.py
│
└── interface/
    └── src/app/(main)/os/...
```

This is completely outside `alaiy_os/interface`.

---

# 6. How Does the Contributing Frontend Import the Base?

There are two reasonable approaches.

## Recommended: Platform package

Turn the reusable parts of the base into a package:

```text
@alaiy-os/ui
@alaiy-os/layout
@alaiy-os/list
@alaiy-os/frappe
```

For example:

```tsx
import { PageHeader } from "@alaiy-os/layout";
import { PeriodToggle } from "@alaiy-os/list";
import { getCompanyInfo } from "@alaiy-os/frappe";
```

Client code owns the composition:

```tsx
export default async function ShopifyListingsPage() {
    const company = await getCompanyInfo();

    return (
        <div className="flex flex-col gap-4">
            <PageHeader
                title="Shopify Listings"
                subtitle="Push and reconcile listings against your Shopify storefront."
                action={<PeriodToggle />}
            />

            <ShopifySyncPanel defaultCurrency={company?.defaultCurrency ?? undefined} />
        </div>
    );
}
```

The client decides what components to render.

---

# 7. But What About Next.js Routing?

This is the tricky part.

Next.js routing is filesystem-based.

You cannot simply put:

```text
alaiy_os_connector_shopify/interface/src/app/(main)/os/channels/shopify/listings/page.tsx
```

inside a Frappe app and expect Next.js to magically discover it.

Therefore we introduce a **build workspace**.

---

# 8. Build Workspace

Neither repository is modified.

Instead:

```text
/tmp/alaiy-os-build/<site>/
```

is created during deployment.

The build system does:

```text
alaiy_os/interface/
       │
       │ clone/copy
       ▼
/tmp/alaiy-os-build/nayaglobal/
       │
       │ apply each app's interface/src overlay
       ▼
alaiy_os_connector_shopify/interface/src/
alaiy_os_nayaglobal/interface/src/
       │
       ▼
/tmp/alaiy-os-build/nayaglobal/
       │
       ▼
npm run build
```

So the workspace becomes:

```text
/tmp/alaiy-os-build/nayaglobal/

├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── (main)/os/
│   │   │   ├── products/            # base
│   │   │   ├── settings/            # base
│   │   │   ├── settings/connectors/shopify/   # from alaiy_os_connector_shopify
│   │   │   └── channels/shopify/listings/     # from alaiy_os_connector_shopify
│   │   └── api/
│   │
│   ├── components/
│   ├── config/
│   │   └── contributed-nav.ts      # generated from the apps' nav declarations
│   └── lib/
│       ├── frappe/                 # base
│       └── nayaglobal/             # from alaiy_os_connector_nayaglobal
│
├── package.json
├── next.config.mjs
├── tsconfig.json                   # the base's own — @alaiy-os/* already in it
├── .env.local                      # generated: FRAPPE_URL for this client's site
├── interface.composed.json         # generated: which app supplied which file
└── ...
```

There is no `src/client/<app>/` staging area. Contributing apps mirror the base's
tree outright and namespace their own directories (`src/lib/nayaglobal/`, routes
under `.../nayaglobal/`), which is what makes collisions rare in the first place
and keeps one path shape for routes and non-routes alike. A contributed file can
therefore use the base's own `@/*` alias for its siblings — `@/lib/nayaglobal/api`
resolves in both the app's own checkout and the workspace.

Then:

```bash
npm run build
```

runs normally.

Because contributing apps mirror the base's `src/app/...` paths exactly, the
overlay is a path-for-path copy — no `routes/` → `app/` translation table to keep
in sync as the base's route groups change.

---

# 9. Client Override Model

There are two types of client customization.

## A. New functionality

Client adds something:

```text
alaiy_os_nayaglobal/interface/src/app/(main)/os/loyalty/
└── page.tsx
```

The build system adds it.

---

## B. Replace existing functionality

Suppose the base has:

```text
alaiy_os/interface/src/app/(main)/os/products/page.tsx
```

The client wants a completely different page.

The client has:

```text
alaiy_os_nayaglobal/interface/src/app/(main)/os/products/page.tsx
```

During composition:

```text
BASE

src/app/(main)/os/products/page.tsx
        ↓
        replaced by
        ↓
CLIENT

alaiy_os_nayaglobal/interface/src/app/(main)/os/products/page.tsx
```

`alaiy_os/interface` remains untouched.

Colocated `_components/` directories are replaced at the same granularity — a
client overriding `products/page.tsx` does **not** implicitly inherit or lose
`products/_components/*`; whatever it ships at that path wins, file by file.

---

# 10. This Gives You Exactly the Direction You Want

The final source relationship is:

```text
                    ┌──────────────────────┐
                    │  alaiy_os/interface  │
                    │                      │
                    │ Platform capabilities│
                    │ UI components        │
                    │ lib/frappe + hooks   │
                    │ SSR/ISR              │
                    └──────────▲───────────┘
                               │
                            imports
                               │
                    ┌──────────┴───────────┐
                    │  App interface/      │
                    │                      │
                    │ Connector screens    │
                    │ Client pages         │
                    │ Overrides            │
                    │ Client routes        │
                    └──────────────────────┘
```

This is **contributing app → base**.

---

# 11. Build Composition

This is `devbench compose` — [lib/interface.py](https://github.com/alaiy-tech/devbench/blob/main/lib/interface.py):

```bash
python3 devbench.py compose nayaglobal
```

The app list and its order are not arguments: they come from
`clients/<client>.py`, the same declaration the bench installs from, so the
composed frontend and the site it talks to can't drift into disagreeing about
which apps are in play. Apps are applied in install order, so the client app
overrides the connector, which overrides the base — the same precedence `bench`
uses for `app_include_js` and hooks, which keeps one mental model for the whole
stack.

Internally:

```text
1. Resolve each app's checkout, and the base version (interface/package.json)
        ↓
2. Check every app's interface.config.json platformVersion against it
        ↓
3. Copy alaiy_os/interface  (minus .git / .next / node_modules)
        ↓
4. Overlay each app's interface/src + interface/public, path-for-path
        ↓
5. Refuse any undeclared collision
        ↓
6. Generate src/config/contributed-nav.ts from the apps' nav declarations
        ↓
7. Provide node_modules, write .env.local + interface.composed.json
        ↓
8. npm run build   (in a deployment: npm ci first)
        ↓
9. Produce Next.js artifact
```

Step 5 is the load-bearing one: two apps claiming one path, or an app replacing a
base file, is an error unless that app lists the path in the `overrides` array of
its `interface.config.json`. Silent last-writer-wins is how this design rots.

`interface.composed.json` in the workspace records which app supplied which file
— the first thing to read when a deployed screen isn't the one you thought you
shipped.

The `@alaiy-os/*` aliases are *not* injected at compose time; they live in the
base's own tsconfig, so a workspace inherits them by being a copy of the base and
there is one fewer generated file to reason about.

---

# 12. Versioning Becomes Important

Don't let a contributing app blindly consume whatever the latest base is.

Have:

```text
alaiy_os_nayaglobal/interface/
    │
    └── interface.config.json
```

```json
{
    "platformVersion": "2.2.0"
}
```

`platformVersion` is checked against `interface/package.json`'s `version` in the
base (currently `2.2.0`).

Then:

```text
NAYAGLOBAL

Base Platform (alaiy_os/interface)
v2.2.0

Client App (alaiy_os_nayaglobal)
v1.8.2
```

Another client:

```text
OTHER CLIENT

Base Platform
v2.1.3

Client App
v4.1.0
```

This means you can upgrade clients independently.

---

# 13. Runtime Architecture

After building:

```text
                         Browser
                            │
                            ▼
                     Nginx / LB
                            │
                            ▼
                    Next.js :3000
                            │
                           PM2
                            │
                ┌───────────┴───────────┐
                │                       │
           SSR / ISR              Server Components
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                  Frappe (FRAPPE_URL)
                        :8000
                            │
                  ┌─────────┴─────────┐
                  │                   │
                MariaDB           Connectors
```

The Next.js server talks to Frappe at runtime, via `FRAPPE_URL` (see
[.env.example](.env.example)) — read server-side only, never bundled into client
JS. Browser-originated calls go through the base's own proxy route handlers:

```text
/api/method/[...path]     → <FRAPPE_URL>/api/method/...
/api/resource/[...path]   → <FRAPPE_URL>/api/resource/...
```

so the browser never talks to Frappe directly, and the `sid` cookie stays
first-party.

There is **no requirement for the Frappe app to execute React code at runtime**.

---

# 14. SSR Flow

For example:

```text
GET /os/products

Browser
   ↓
src/proxy.ts (session gate on /os/*)
   ↓
Next.js
   ↓
Client / connector page (Server Component)
   ↓
lib/frappe/*.server.ts
   ↓
Frappe API (alaiy_os.api.item_stats)
   ↓
Item DocType
   ↓
Next.js renders HTML
   ↓
Browser
```

So a contributed page can still be a Server Component — exactly like the base's
own [products page](src/app/(main)/os/products/page.tsx):

```tsx
export default async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const period = readPeriod(await searchParams);
    const [overview, company] = await Promise.all([
        getProductsOverviewServer(period),
        getCompanyInfo(),
    ]);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title="Products" action={<PeriodToggle />} />
            <ProductKpiCards
                overview={overview}
                period={period}
                defaultCurrency={company?.defaultCurrency ?? undefined}
            />
        </div>
    );
}
```

SSR remains completely intact.

---

# 15. ISR

Same thing.

A contributed page can define:

```tsx
export const revalidate = 300;
```

Then:

```text
Next.js
   ↓
ISR cache
   ↓
Frappe API
```

Again, nothing about the overlay architecture prevents ISR. Note that the `/os/*`
surface is session-gated and per-user, so ISR is mostly for public/marketing
routes and any genuinely shared read-only data — not for dashboard pages.

---

# 16. Client Configuration

Configuration should be separate from actual React code.

```text
alaiy_os_nayaglobal/interface/
├── interface.config.json
├── src/styles/
└── src/app/
```

```json
{
    "app": "alaiy_os_nayaglobal",
    "platformVersion": "2.2.0",
    "nav": [
        {
            "group": "Sales",
            "items": [{ "id": "loyalty", "title": "Loyalty", "url": "/os/loyalty", "icon": "gift" }]
        }
    ],
    "overrides": ["src/app/(main)/os/products/page.tsx"]
}
```

JSON rather than TypeScript, for one reason that decides it: the composer reads
this file, and the composer is stdlib Python that cannot evaluate a `.ts` module.
TS can still `import config from "./interface.config.json"` (`resolveJsonModule`
is on), so nothing is lost on the consuming side.

`icon` is a lucide-react name in lower-kebab-case. The composer turns the `nav`
blocks of every app into `src/config/contributed-nav.ts` — emitting the icon
imports it needs — and [sidebar-config.ts](src/config/sidebar-config.ts) folds
that list into its own groups by matching `group` against a group `label`. An
unrecognised label opens a new group, which is what lets a client add a section
the base has never heard of.

The base's checked-in `contributed-nav.ts` is an empty array. That is the whole
of its knowledge about connectors and clients: it consumes whatever lands there
without knowing who supplied it, the same shape as `connector_meta.py` on the
Python side — the app declares, the platform consumes generically. Two apps
contributing the same nav id to the same group is a compose-time error.

---

# 17. Frappe Runtime Data

The Frappe backend remains completely independent:

```text
Composed Next.js
       │
       │ HTTP (FRAPPE_URL)
       ▼
Frappe bench site
       │
       ├── alaiy_os              (DocTypes, api/, OS Connector Registry)
       ├── alaiy_os_commerce     (shared domain logic)
       ├── alaiy_os_connector_*  (channel integrations)
       └── alaiy_os_<client>     (client logic)
```

For example, mirroring the base's existing `src/lib/frappe/*` modules:

```ts
// base — src/lib/frappe/item-stats.server.ts
await frappeFetch("/api/method/alaiy_os.api.item_stats.get_products_overview?period=30d");

// connector — alaiy_os_connector_shopify/interface/src/lib/frappe/shopify-sync.ts
await frappeFetch("/api/method/alaiy_os_connector_shopify.api.sync.get_sync_status");
```

The frontend knows the backend API contract.

Where a screen is genuinely connector-agnostic, prefer the registry-driven
indirection the Python side already uses (`alaiy_os/connectors.py` resolves sync
methods by label off `OS Connector Registry`) over hardcoding a connector's
dotted path in the base.

---

# 18. Important Rule: Don't Put Business Logic in Next.js

Next.js should mostly be:

```text
Rendering
Routing
SEO
Caching
Frontend composition
```

Frappe should own:

```text
Business rules
Database
ERP data
Orders
Inventory
Pricing rules
Connector logic
Permissions
```

So:

```text
Next.js
   │
   │ "Give me Item X"
   ▼
Frappe (alaiy_os.api.*)
   │
   │ business logic
   ▼
MariaDB / connectors
```

---

# 19. Suggested Contributing App Structure

I'd make the convention strict:

```text
alaiy_os_<app>/
│
├── alaiy_os_<app>/                   # Frappe app (python) — unchanged
│   ├── api/
│   ├── alaiy_os_<app>/doctype/
│   ├── setup/  patches/  public/
│   ├── connector_meta.py             # connectors only
│   └── hooks.py
│
├── interface/                        # frontend contribution
│   │
│   ├── src/
│   │   ├── app/                      # mirrors the base's route tree exactly
│   │   ├── components/
│   │   ├── lib/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── types/
│   │
│   ├── interface.config.json         # app id, platformVersion, nav, overrides
│   ├── tsconfig.json                 # editor only — see below
│   └── package.json                  # declarative; nothing installs from here
│
└── pyproject.toml
```

And establish:

```text
interface/
    ↓
may import
    ↓
@alaiy-os/*
```

but:

```text
@alaiy-os/*
    ✕ cannot import
    ↓
alaiy_os_<app>
```

This dependency rule should be enforced in CI — a Biome/lint rule banning
imports of any `alaiy_os_*` app from anything under the base's `src/`, run in
`alaiy-tech/alaiy_os`. Not yet written.

A contributing app's `tsconfig.json` only exists so an editor can follow
`@alaiy-os/*` to a sibling checkout. Nothing reads it at compose time — the
typecheck that counts is the base's own, inside a composed workspace. For the
same reason there is no `biome.json` in a contributing app: `extends` needs a
resolvable path, and the base isn't a dependency of these repos.

---

# 20. Deployment Example

Suppose:

```text
Base repo:
github.com/alaiy-tech/alaiy_os          (Next.js app in interface/)

Connector:
github.com/alaiy-tech/alaiy_os_connector_shopify

Client:
github.com/alaiy-tech/alaiy_os_nayaglobal
```

Deployment:

```bash
bench get-app alaiy_os
bench get-app alaiy_os_connector_shopify
bench get-app alaiy_os_nayaglobal

bench --site nayaglobal install-app alaiy_os
bench --site nayaglobal install-app alaiy_os_connector_shopify
bench --site nayaglobal install-app alaiy_os_nayaglobal
bench --site nayaglobal migrate

alaiy-interface-compose \
    --base /home/frappe/frappe-bench/apps/alaiy_os/interface \
    --app  /home/frappe/frappe-bench/apps/alaiy_os_connector_shopify \
    --app  /home/frappe/frappe-bench/apps/alaiy_os_nayaglobal \
    --output /deploy/nayaglobal
```

Produces:

```text
/deploy/nayaglobal/.next/
```

Then:

```bash
pm2 start ecosystem.config.js
```

Example:

```js
module.exports = {
    apps: [
        {
            name: "nayaglobal-interface",
            script: ".next/standalone/server.js",
            env: {
                NODE_ENV: "production",
                PORT: 3000,
                FRAPPE_URL: "http://nayaglobal.localhost:8000",
            },
        },
    ],
};
```

`.next/standalone` requires `output: "standalone"` in
[next.config.mjs](next.config.mjs), which the base now sets.

---

# 21. What Happens When You Update the Platform?

You release:

```text
alaiy_os/interface v2.3.0
```

Then:

```text
NAYAGLOBAL
    Base v2.2.0
    Client v1.8.2

       ↓ upgrade

NAYAGLOBAL
    Base v2.3.0
    Client v1.8.2
```

Build again.

If the client's frontend contract is compatible:

```text
✅ build
```

If not:

```text
❌ compile error
```

That's actually desirable — but only if the build is green to begin with, and two
things currently stop that:

* `alaiy_os/interface` on `main` has **25 pre-existing type errors**, so
  `next build` fails at "Running TypeScript" before it can tell anyone about a
  contributed screen. They are in base files (the dead
  `app/(main)/os/_components/sidebar/*`, `products/_components/overview-kpis.tsx`,
  and `CheckedState` on five table column files) and predate composition — a
  composed workspace reproduces exactly the same 25 and adds none. Fixing them is
  the prerequisite for this section to mean anything.
* The base runs `strict: false` in [tsconfig.json](tsconfig.json), which blunts
  the tripwire further. Worth tightening once the errors above are cleared.

---

# 22. What should NOT be done

### ❌ Runtime React loading from Frappe

Don't do:

```text
Next.js
   ↓
Frappe
   ↓
download React component
   ↓
execute it
```

Bad for:

* SSR
* security
* caching
* deployments
* type safety
* debugging

---

### ❌ Base importing a contributing app

Avoid, anywhere under `alaiy_os/interface/src/`:

```ts
import shopify from "@client/alaiy_os_connector_shopify";
```

The base must remain client- and connector-agnostic. Connector-specific behaviour
reaches the base through `OS Connector Registry` rows, not imports.

---

### ❌ Forking the base

Don't create:

```text
alaiy_os                    (interface/)
alaiy_os_nayaglobal         (forked interface/)
alaiy_os_interface_client_a
alaiy_os_interface_client_b
```

You'll eventually have divergence hell.

---

### ❌ Runtime filesystem dependencies

Don't make the production Next.js process depend on:

```text
/home/frappe/frappe-bench/apps/alaiy_os_nayaglobal/interface
```

The contributed frontend should be **compiled into the Next.js deployment
artifact**. Frappe's own `public/` asset pipeline (`bench build`) is for the
Desk-side assets in `alaiy_os/public/`, and is unrelated to this build.

---

# 23. Final Architecture

The whole system becomes:

```text
                 ┌─────────────────────────┐
                 │   alaiy_os/interface    │
                 │                         │
                 │  Routing infrastructure │
                 │  SSR / ISR              │
                 │  UI primitives          │
                 │  lib/frappe data layer  │
                 │  SEO                    │
                 │  Platform APIs + proxy  │
                 └────────────┬────────────┘
                              │
                         imported by
                              │
                 ┌────────────▼────────────┐
                 │  CONTRIBUTING FRAPPE    │
                 │  APPS                   │
                 │                         │
                 │  Backend (api/)         │
                 │  DocTypes               │
                 │  DB                     │
                 │  Connectors             │
                 │                         │
                 │  interface/             │
                 │   ├── Routes            │
                 │   ├── Components        │
                 │   ├── Pages             │
                 │   └── Overrides         │
                 └────────────┬────────────┘
                              │
                       BUILD COMPOSER
                              │
                              ▼
                    ┌──────────────────┐
                    │  Next.js Build   │
                    │                  │
                    │  SSR + ISR       │
                    │  Server Comp.    │
                    └────────┬─────────┘
                             │
                            PM2
                             │
                             ▼
                         Production
```

### The core idea in one sentence

**`alaiy_os/interface` becomes the immutable frontend platform; each connector,
agent, and client Frappe app owns its own `interface/` contribution, imports
capabilities from the platform via `@alaiy-os/*`, and a deployment composer
combines them into a normal SSR/ISR Next.js build.**

This gives you the exact dependency direction you asked for:

```text
App interface/
      ↓
alaiy_os/interface
      ↓
   Next.js
      ↓
     PM2
```

rather than:

```text
alaiy_os/interface
      ↓
App interface/
```

And importantly, **no Frappe app needs to "patch" a running Next.js server**. It
contributes source code **before build time**, while Frappe itself remains the
runtime backend.

---

# 24. Implementation status

The first connector through this architecture is
`alaiy_os_connector_nayaglobal`, which contributes the Wishlist and Cart screens.

## Landed

**`alaiy_os`** — the platform side:

* `@alaiy-os/*` wildcard aliases in [tsconfig.json](tsconfig.json) (§3).
* `output: "standalone"` in [next.config.mjs](next.config.mjs) (§20).
* [src/config/nav-types.ts](src/config/nav-types.ts) — the sidebar's item types,
  extracted out of `sidebar-config.ts` so the generated nav file can share them
  without an import cycle.
* [src/config/contributed-nav.ts](src/config/contributed-nav.ts) — empty here,
  generated in a workspace.
* [src/config/sidebar-config.ts](src/config/sidebar-config.ts) — merges
  contributions into its groups by label.
* [src/lib/frappe/connectors.ts](src/lib/frappe/connectors.ts) — a typed client
  for `alaiy_os.api.connectors`, which is generic over `OS Connector Registry`:
  it reads and writes whatever settings DocType a connector registered and runs
  that connector's own `test_method`. A connector's settings screen therefore
  needs no Python of its own, and the base needs no knowledge of which
  connectors exist. [src/lib/frappe/link.ts](src/lib/frappe/link.ts) goes with it,
  for Link fields whose target DocType isn't known until runtime.

**`devbench`** — `lib/interface.py` + `devbench.py compose <client>` (§11).

**`alaiy_os_connector_nayaglobal`** — `interface/` with `interface.config.json`,
three screens under `/os/procurement/nayaglobal/{wishlist,cart,settings}`, and
`src/lib/nayaglobal/` over its own whitelisted methods. Working this connector
involves the Desk at no point: Settings replaces its Desk form too.

Verified by composing the `commerce` client (base + this connector): Turbopack
compiles it, the connector's routes appear in the build's route table alongside
the base's, and `.next/standalone/server.js` is produced.

## Decisions this made that §1–§23 left open

* **Where a connector's screens live.** NayaGlobal is a *supplier*
  (`connector_type` in `connector_meta.py`) — this bench buys on it — so its
  screens sit under the base's existing **Procurement** group rather than the
  `channels/` shape §5 sketches for a sales channel like Shopify. A connector
  contributes into whichever part of the base's IA it actually belongs to.
* **`node_modules` in a workspace is hard-linked** from the base checkout, not
  symlinked: Turbopack treats the project directory as a filesystem root and
  rejects a symlink pointing out of it. Costs seconds and no disk. A deployment
  runs `npm ci` in the workspace instead, per §22's no-runtime-filesystem rule.
* **A connector owns its settings screen, not the base.** The obvious home for
  connector settings is a base-side `/os/settings/connectors/<id>` rendering a
  form off field metadata. It isn't: a connector's settings are the one screen
  most in need of that connector's own vocabulary — which of two places the API
  URL is really coming from, what "enabled" costs, that the wishlist is read
  live. The generic API stays in the base; the screen ships with the app whose
  fields it explains. That also keeps the "no Desk" promise reachable one
  connector at a time, rather than blocked on a base-side panel.

## Not done yet

* The 25 pre-existing base type errors (§21). Until they are fixed, a composed
  build only passes with `typescript.ignoreBuildErrors`, and the "platform
  upgrade breaks a client at compile time" guarantee is theoretical.
* A base-side connectors *index* — somewhere to see every registered connector
  and its status at a glance. `get_all_connectors` already returns exactly that;
  nothing renders it. Individual connectors don't need it (each ships its own
  settings screen), so this is a convenience, not a blocker.
* The other Desk surface this connector still has: **NayaGlobal Log**, contributed
  to the Desk sidebar via `alaiy_os_sidebar_log_items`. Same treatment as
  Settings would finish the job.
* The CI lint rule enforcing the dependency direction (§19).
* Deployment wiring: `npm ci` + PM2 from a composed workspace (§20) is described
  but not scripted.
* The Desk pages this duplicates are untouched and still shipping. Retiring them
  is a separate decision, once the Next.js screens have been used in anger.
