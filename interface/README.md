# Alaiy OS — Self-Serve

Self-serve tier for Alaiy OS. A Shopify or Amazon seller signs up, connects their
accounts, imports 90 days of data, and starts operating — no hand-holding.

This is the frontend `alaiy_os` ships, and the one a deployment gets unless an
app installed later claims the base for itself (see the repo
[README](../README.md#interface--the-frontend-this-app-ships)). `devbench
compose <client>` builds a workspace out of this tree and writes `.env.local`
from the `env` map in `interface.config.json`; `npm run dev` here runs it
standalone against whatever `.env.local` you write by hand.

Spec: [issue #1](https://github.com/alaiy-tech/alaiy_os_self_serve/issues/1).
This repo implements **P0 — Auth + Onboarding** and the **P1 core tabs**:
Home, Orders, Inventory and Channels.

The design system — paper ground, navy panels, one accent, one button shape —
is documented in [DESIGN.md](DESIGN.md), with the tokens themselves in
`src/app/globals.css`.

## Running it

```bash
cp .env.example .env.local     # then fill in the blanks
openssl rand -base64 32        # -> SESSION_SECRET
npm run dev
```

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
| `api.dashboard.tiles` | The figures behind Ask Alaiy's opening line. |
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
and Slack. P3 is alerts, Stripe metering and upgrade gates. The Home dashboard
tiles were built and then removed: Home is the question box, and the tiles'
figures now feed Ask Alaiy's opening line instead. `api.dashboard.tiles` and
the `DashboardTiles` type are still there for whatever brings a dashboard
back.
