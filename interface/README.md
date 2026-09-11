# Alaiy OS — Self-Serve

Self-serve tier for Alaiy OS. A Shopify or Amazon seller signs up, connects their
accounts, imports 90 days of data, and starts operating — no hand-holding.

Spec: [issue #1](https://github.com/alaiy-tech/alaiy_os_self_serve/issues/1).
This repo implements **P0 — Auth + Onboarding** and the **P1 core tabs**:
Home, Dashboard, Orders, Listings, Inventory, Account Health and Channels.

The design system — paper ground, navy panels, one accent, one button shape —
is documented in [DESIGN.md](DESIGN.md), with the tokens themselves in
`src/app/globals.css`.

## Running it

```bash
cp .env.example .env.local     # then fill in the blanks
openssl rand -base64 32        # -> SESSION_SECRET
npm run dev
```

### Running it with nothing behind it

```bash
npm run dev:demo               # no .env.local needed
```

Opens on the Dashboard, signed in as a seller who does not exist, reading a
workspace that does not exist. Every tab renders — Dashboard, Orders, Listings,
Shipping, Inventory, Profitability, Ratings, Account Health, Channels and Ask
Alaiy — with rows you can filter, sort, page through and open. A marker in the
corner of every screen says the data is fabricated.

It exists because checking a change to the Orders table should not require a
Google account, an ERPNext bench and a workspace with ninety days of orders in
it. Two choke points are replaced and nothing else is: `getSession` in
`src/lib/auth/dal.ts` hands back a fabricated session, and `backendRequest` in
`src/lib/backend/client.ts` answers from `src/lib/dev/` before it opens a
socket. The pages, layouts, Server Actions and Route Handlers above them are
the ones that ship, unaware.

The fabricated world is one catalogue of fourteen products, and the listings,
orders, stock cover, margins, carriers, tiles and alerts are all readings of it
— so a tile and the table under it agree, and so does what Ask Alaiy tells you.
It is seeded, not random: the same rows survive a reload, which is what makes a
screenshot worth taking.

The states that are hard to arrange against a real backend are the ones it
deliberately holds: a suppressed Amazon listing, a channel a day behind on
sync, a SKU whose fees Amazon declined to quote, a carrier too thin to quote a
percentage for. Those are what the honesty fields on these tabs exist to render,
and a demo where every flag was green would hide all of them.

The base declares the flag in `interface/interface.config.json` as
`"demo": "ALAIY_DEMO"`, so devbench can offer `devbench demo <client>` without
knowing which app is the base or what its variable is called — the same way it
already learns the environment the base reads. A client whose base declares no
`demo` key is told so by name rather than started into a broken screen.

`ALAIY_DEMO` cannot be turned on in a deployed app. `next build` inlines
`NODE_ENV` as `"production"`, so the flag folds to `false` at build time and
every branch behind it is eliminated — `DEMO_MODE` does not appear in the built
server at all, and nothing under `src/lib/dev/` reaches a browser bundle. The
fixtures are behind a dynamic `import()` in the backend client for that reason:
the module is never loaded on a line that no longer exists.

## Architecture

### The browser never talks to the backend

Every call to `os.alaiy.com` is made from the Next.js server. The browser only
ever talks to its own origin — Server Actions and Route Handlers — which call
through to ERPNext on its behalf.

```
browser ──same-origin──> Next.js server ──> os.alaiy.com (ERPNext)
           Server Actions                    src/lib/backend/client.ts
           Route Handlers
```

This is why there is no CORS configuration anywhere, and why **no environment
variable is prefixed `NEXT_PUBLIC_`**. `src/lib/env.ts` and every module under
`src/lib/backend/` import `server-only`, so importing one from a Client
Component is a build error rather than a silent credential leak.

`src/lib/backend/client.ts` is the single place that knows the backend URL. It
handles auth headers, timeouts, ERPNext's `{ message: … }` envelope, and turns
failures into a typed `BackendError`.

### Auth and sessions

No passwords anywhere. Google SSO, or a fresh 6-digit OTP on every login.

The session is a stateless JWT (`jose`, HS256) in an `httpOnly`, `sameSite=lax`
cookie. It carries the user, their ERPNext Company (the workspace scope), tier,
and where they are in onboarding.

Two layers of protection, deliberately:

- `src/proxy.ts` — Next.js 16's replacement for middleware. Reads the cookie and
  redirects. This is a **routing optimisation, not the authorisation boundary**,
  and it never touches API routes (a polling `fetch` needs a 401, not HTML).
- `src/lib/auth/dal.ts` — every page and Server Action re-verifies here. This is
  the boundary.

Every OAuth round trip is CSRF-protected by a signed, expiring `state` JWT whose
nonce is mirrored into an `httpOnly` cookie (`src/lib/auth/oauth-state.ts`).
Shopify callbacks additionally verify Shopify's own HMAC and that the returning
shop matches the one the flow started with.

### Layout

```
src/
  proxy.ts                    optimistic route protection
  lib/
    env.ts                    server-only env access
    channels.ts               channel catalogue
    backend/                  the ERPNext contract (see below)
    auth/                     sessions, DAL, per-provider OAuth
    listing.ts                query-string parsing for the listing tabs
  components/
    data/                     table, toolbar and pager primitives
    ask/                      the Ask Alaiy panel and its (inert) composer
  app/
    start/                    sign-in / sign-up
    onboarding/               profile -> channels -> connect -> import
    (app)/                    the signed-in shell: rail, screen, Ask panel
      home/                   Ask Alaiy, centred
      orders/                 orders, every channel, problems first
      inventory/              products, every channel
      channels/               connection status, manual sync, disconnect
    api/auth/                 Google SSO, logout
    api/connect/              Shopify + Amazon OAuth callbacks
    api/import/status         same-origin polling for the progress screen
    api/orders/export         the Orders tab's filtered view, as a CSV
```

### The listing tabs keep their state in the URL

Orders and Inventory hold every filter, the sort column and the offset in the
query string. Filtering is a GET form (`next/form`), and sorting and paging are
links — so the server does the querying, the back button behaves, and a
narrowed-down view can be pasted to someone else. Nothing about a table lives
in client state.

Both tables show each channel's own status text unmapped. Shopify says
`UNFULFILLED` where Amazon says `AFN` — its fulfilment *channel*, not a status
— so there is no shared vocabulary to filter on, and inventing one would mean
claiming something neither channel said.

Orders adds one vocabulary that *is* shared, and it is derived rather than
mapped: five **flags**, defined once in the backend's `selfserve/order_flags.py`
from the statuses the syncs actually write — unfulfillable, payment pending
past its threshold, unshipped past its threshold, refunded, cancelled. A flag
means the same thing on both sides, so the tab can filter on it and rank by it
while still showing every raw status untouched. Amazon's AFN/MFN is what makes
two shipping thresholds real rather than arbitrary: AFN is Amazon's warehouse,
MFN and every Shopify order are the seller's own. The thresholds live on the
workspace and are edited on the tab itself.

A row on Orders is one **order**, grouped from its lines in SQL. Grouping in
the frontend was the obvious alternative and is wrong: an order's lines
straddle a page boundary, so page one would show half an order, "problems
first" would only rank the rows that happened to be fetched, and the header
would count orders while the pager counted lines.

What is deliberately *not* flagged: carrier delays, "no scan in 48 hours", and
"cancelled after dispatch". The order DocType holds no tracking, carrier or
shipment, so each would be a guess wearing a coloured dot. The detail panel
says so where a seller would look for it.

### The Dashboard is the glance; Home is the question

The Dashboard replaces the ritual the product exists to kill — Seller Central,
the Shopify admin, a spreadsheet, email and a tracker, all opened before
anything useful has happened. Four figures, up to three things Alaiy noticed,
the last ten orders, and when each channel was last pulled.

It is its own route rather than a band under Ask Alaiy. The spec folds all of
this into Home, and Home is the Ask surface — built that way, the figures sat
below the fold on the one screen whose whole job is to be read at a glance.
Scanning four numbers and reading a transcript are different postures, so they
are two rows in the rail. The docked Ask panel comes along on the Dashboard as
it does on every data tab, so a question about a number stays one click from
the number. Nothing on the Dashboard is a place to work: every alert and every
order row leads to the tab where the thing can actually be done.

**The four tiles do not share a window, and each one says which it is.** GMV
and orders are today so far; the return rate is a rolling week, because one day
of returns is not a rate; unsettled is empty, because settlements are not
synced. A row of tiles that looked alike but meant different periods would be
the most misleading thing that could go on this screen.

**"Today vs. the same day last week" is compared at the same time of day.** The
naive reading — today's rows against the whole of that day's — reports a
collapse every morning, because a partial day always loses to a full one. Both
windows end at the same clock time seven days apart.

**The alert bar is inference, and it is honest about its sources.** Six
detectors in `selfserve/home_alerts.py`, each a pattern actually visible in the
synced data: a channel erroring, a channel overdue a pull, orders needing
attention, a return-rate spike, this week's sellers at zero stock, and sales
behind the same weekday. The spec also sketched alerts about carrier scans,
Amazon disbursement holds and review patterns — none is derivable, so none is
there. Alerts are ranked by severity rather than time, capped at three, and
carry a `tab` rather than a URL: which surface fixes a stuck order is the
backend's business, what that surface's path is belongs to `lib/dashboard/alerts.ts`.

A dismissal is a row in `Alaiy Alert Dismissal`. It survives navigation — an
alert does not clear because the seller visited the tab it points at, since
they may well have gone there for something else — and two things bring it
back: the condition clearing and later returning, and the condition getting
materially worse.

Recent orders and last-synced are read through `list_orders` and
`list_connections` rather than duplicated into the Home payload, so there is
one definition of "flagged" and one of "last synced" in the product.

### Account Health is Amazon-only, and says so

Amazon can deactivate a seller account when a performance metric crosses a
published threshold. Seller Central shows the number; it does not say how much
room is left, which orders are spending it, or where the Late Shipment Rate
lands if the orders sitting unshipped go out late. That arithmetic is the tab.

Shopify has no account-suspension mechanism, so there is no Shopify equivalent
to show. That is labelled in the header as a design decision rather than left
as an apparent gap.

All four metrics the spec fixes are **queryable, not calculated** — that was
the open question on the issue. `GET_V2_SELLER_PERFORMANCE_REPORT` carries all
of them, and the SP-API connector already parses it in the three encodings
Amazon has shipped it as. Three more metrics come back in the same report and
are shown below the four rather than dropped.

**Health rows are workspace-scoped in this app, deliberately.** The connector
stores its own metrics in `Account Health Metric`, keyed
`{marketplace}::{metric_key}` — no seller in the key, over a global marketplace
table. On a bench where every seller shares a site that means two sellers on
amazon.in overwrite each other and a read returns the wrong seller's account
health. So this app owns `Alaiy Account Health Metric` and `Alaiy Seller
Feedback`, both with a required indexed `workspace`, and no endpoint accepts a
workspace argument — there is no parameter through which to name another
seller's. The connector's two tables are never read.

Rows are a daily series rather than a snapshot: Amazon's report has no history,
so a value not stored on the day it was read is gone. That makes the 60-day
trend accumulate from the first sync, and the chart says how many days it
actually has instead of drawing a 60-day axis over five points. It is drawn as
small multiples — one panel per metric with its own scale and its own threshold
line — because Order Defect Rate lives near 1% and Valid Tracking Rate near
97%, and one shared y-axis flattens the metric most likely to suspend an
account into the baseline.

The late-shipment projection the spec asks for in V1 is there and **labelled an
estimate**: Amazon publishes the rate but neither the window nor the shipment
count behind it, so the denominator is our own synced order count and the panel
shows it. Which orders are at risk comes from Amazon's own `LatestShipDate`,
now persisted — it was already in the `getOrders` payload and being discarded.

Two things the spec asks for have no source and are stated where a seller would
look for them: policy warnings need the Performance Notifications API, and
A-to-Z claims and chargebacks arrive as counts rather than per order, so the
orders behind ODR are the ones with negative feedback.

### Product groups: one product, two channels

The Canvas Tote Bag is one thing to photograph, describe and reorder. That it
is `CT-TOTE-BLK-001` on Shopify and `B09XKQL3M2` on Amazon is an accident of
where it is listed — and it is why an Amazon suppression can sit for a week
with nothing in Shopify mentioning it. A **product group** is that product,
and it is the shared idea behind two tabs, which is why its shapes and its
seed data live in `lib/product-groups/` rather than in either one.

**Listings** (`/listings`) is one row per product with both channels' status
side by side, and a detail view that puts the two listings in two columns —
same fields, same order, same scale, because the comparison *is* the feature.
Amazon's suppression codes are translated to plain English with the raw code
kept in the tooltip. Read-only: V1 links out to the live listing and to the
seller's own admin, and the header says so, because a tab that looked editable
and silently was not would be worse than one that is honest. The unlinked panel
is the queue that keeps the rest honest — every unmatched product is somewhere
a suppression could hide — and it distinguishes a barcode match (certain) from
an AI suggestion above the spec's 85% threshold (offered for confirmation) from
one below it (no suggestion at all, because a guess invites a confirming click
and a wrong link merges two products' inventory).

**Inventory** now has two grains, and the toggle is in the URL. *By product* is
the new one: the warehouse's number, Shopify's and Amazon FBA's shown
separately rather than summed, plus the days-of-cover arithmetic none of the
three sources does for you, and the open POs sorted by the cover of what they
restock. *By channel listing* is the original per-channel table and it is kept,
not replaced — the per-channel price and stock figure are facts a merged row
would have to average away.

Two things that table refuses to do: **no cover is not zero cover** (a SKU with
stock and no sales has no rate to divide by, and painting it critical would
send someone to reorder the one product they should not), and **the three
numbers are never reconciled** — where Shopify disagrees with the warehouse the
row says so and by how much, because that gap is the oversell risk.

**Both now read live data.** `lib/backend/listings.ts` and `loadStock` in
`lib/backend/inventory.ts` call `api.listings.*` and `api.inventory.stock`; the
seed data they replaced is gone. The `sample` flag stays in the shape and the
banner still renders off it — the backend answers `false`, so the banner
removed itself with nobody having to remember a switch, which is the whole
point of having put it there. It is kept for the next stubbed endpoint.

Listings is read-plus-decide rather than read-only. Edits still happen on the
channel, but three decisions are made here, because no sync can make them:
confirming that two listings are the same product, marking a product
single-channel on purpose, and undoing a join. A barcode match links itself; a
title match only ever *offers*, and a person confirms — a wrong join merges two
products' stock into one row and nothing downstream can detect it, so the cost
of asking is a click.

### Ask Alaiy is deliberately inert

The prompt is disabled and says so, on Home and in the docked panel, because
the query layer is P2. What is real is the shell: the panel persists across the
data tabs, its suggestions change per route, and its opening line is built on
the server from the seller's own figures. The panel hides itself on `/home`,
which *is* the Ask surface — two composers on one screen would be one too many.

## What the backend must expose

The app assumes these whitelisted ERPNext methods. Paths live next to each call
in `src/lib/backend/*.ts` — change them there if the names differ. Shapes are in
`src/lib/backend/types.ts`.

| Method | Purpose |
| --- | --- |
| `alaiy.auth.request_otp` | Email a 6-digit code. Returns `{ expires_in }`. |
| `alaiy.auth.verify_otp` | Verify, provision a workspace on first sign-in, return `{ user, workspace, token }`. |
| `alaiy.auth.google_sign_in` | Same, for a verified Google identity. |
| `alaiy.workspace.get` | Workspace + provisioning status. |
| `alaiy.workspace.save_profile` | Name, company, role (email path only). |
| `alaiy.workspace.save_channels` | Which channels the seller picked. |
| `alaiy.connectors.list` | Connection status per channel. |
| `alaiy.connectors.save_shopify` | Store the access token **and register the webhooks**. |
| `alaiy.connectors.save_amazon` | Store the SP-API refresh token; start hourly polling. |
| `alaiy.connectors.disconnect` | Remove a connection. |
| `alaiy.imports.start` | Queue the 90-day backfill. Returns a job. |
| `alaiy.imports.status` / `alaiy.imports.latest` | Progress for the import screen. |
| `api.imports.resync` | Re-pull one channel/kind. The Channels tab's "Sync now". |
| `api.listings.groups` | Product groups with both channels' listings, plus the unlinked queue. |
| `api.listings.link` | Link an unmatched product to a group, or mark it channel-exclusive. |
| `api.inventory.stock` | Inventory by product group: every source's stock, days of cover, open POs. |
| `api.account_health.overview` | The Account Health banner, tiles, late-shipment outlook and gaps. |
| `api.account_health.trend` | Stored daily readings for the 60-day chart. |
| `api.account_health.contributing` | The orders behind one metric, where they can be attributed. |
| `api.account_health.refresh` | Queue a fresh performance-report pull. |
| `api.dashboard.home` | The Home dashboard: four tiles at their own windows, plus the alert bar. |
| `api.dashboard.dismiss_alert` | Hide one Home alert until it changes, or clears and returns. |
| `api.dashboard.tiles` | One window and the one before it. The figures behind Ask Alaiy's opening line. |
| `api.orders.list_orders` | The Orders tab: one row per order, flagged and ranked. |
| `api.orders.order_detail` | One order and its lines, for the detail panel. |
| `api.orders.list_order_items` / `api.orders.summary` | The line grain, and a window-wide split by channel. Still whitelisted; nothing in the app calls them now. |
| `api.workspace.save_flag_rules` | The thresholds that decide when an order is a problem. |
| `api.inventory.list_products` / `api.inventory.summary` | The Inventory tab. |

Two things the backend owns rather than this app, because it holds the tokens
and the queue: **registering Shopify webhooks** after `save_shopify`, and
**sending the import-completion email**.

Workspace isolation is enforced on both sides — every call is scoped to the
session's Company, and calls are made with the user's own ERPNext token where
one is issued, so ERPNext's permissions apply as a second check.

## Not yet built

Finance and Settings are in the rail as inert rows — visible so the shape of
the product is legible, not links, because a link to a route that does not
exist reads as broken rather than as unfinished.

P2 is the NL query layer that makes Ask Alaiy answer, plus pinning, WhatsApp
and Slack. P3 is Stripe metering and upgrade gates.

The unsettled tile is the one figure on Home with no source: there is no
settlement DocType and no handler for one in `selfserve.sync.HANDLERS`, so it
reports itself unavailable rather than showing a zero that would read as "you
have been paid everything". `SETTLEMENTS_AVAILABLE` in `api/dashboard.py` is
the single place that changes when Finance lands.

Policy warnings on Account Health are waiting on the Performance
Notifications API, and per-order attribution for A-to-Z claims and chargebacks
on something richer than Financial Events' counts.

Two Home alerts are waiting on the same gap. "No carrier scan in 48 hours" and
"cancelled after dispatch" need a shipment with a tracking number and a
dispatch timestamp, and the order DocType holds neither; a disbursement-hold
alert needs settlements. All three belong in `selfserve/home_alerts.py` beside
the six that are there, the day their data is synced.
