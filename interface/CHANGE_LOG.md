# Change Log

All notable changes to Alaiy OS Self Serve, grouped by the release that shipped them.

---

## 0.1.20 — 2026-09-11

**The consent screen, afterwards — permissions on the channel card**

- Every channel card now carries the list of permissions the seller approved when
  they connected it: Amazon's SP-API roles, a Shopify custom app's scopes, under the
  channel's own names so the two can be read side by side. Closed by default; the
  summary line says when something is narrowed.
- Each row has a dropdown — **Always allow**, **Needs approval**, **Blocked**. These
  are not decoration: `sync.start` and the worker both consult them, so "needs
  approval" keeps the hourly and daily schedules off a permission while leaving
  **Sync now** working, and "blocked" stops the pull either way. A pass drawing on
  more than one role is held by the strictest of them.
- Blocking or gating a *core* permission raises a warning on the card naming what
  stops refreshing, because orders and products come from those two.
- The dropdown is uncontrolled and remounted on the stored value plus the action's
  settle count. Three versions: a plain uncontrolled select never picks up the new
  value, because `refresh()` does not push a fresh `defaultValue` into a select
  someone has touched; a controlled one loses to React's synchronous restore, which
  lands after the transition carrying the new value; and keying on the error text
  left a second identical failure — the `OUR_FAULT` fallback is a constant — showing
  an unsaved choice. All three left the row disagreeing with the summary line above it.
- An unconnected card reads as a preview, not a grant: "what connecting Amazon would
  ask for", no legend and no dropdowns, rather than telling a seller they approved
  access to an account they have not attached.

## 0.1.19 — 2026-09-08

**Listings and Inventory read the real endpoints**

- Seed catalogues deleted. The pages now read `api.listings.overview`,
  `api.listings.group` and `api.inventory.stock`. `sample` stays in the response shape,
  so the mock-data banner removed itself when the backend started answering `false` —
  no switch to remember.
- Listings is no longer read-only. Three decisions no sync can make are made here:
  confirming two listings are one product, marking a product single-channel on purpose,
  and undoing a join. Each row gets its own form and action state, so one product's
  failure can't surface against another.
- Filtering moved to the backend. Health, channel and category go with the request, so
  the category dropdown and the filtered set are computed from one read and cannot
  disagree about what exists. The open group is a second call keyed by `?group=` rather
  than a `find()` over the list.

## 0.1.18 — 2026-09-07

**Product groups: one product, two channels, three stock numbers**

- Introduces the product group — the thing you photograph, describe and reorder —
  independent of it being `CT-TOTE-BLK-001` on Shopify and `B09XKQL3M2` on Amazon.
  Shapes and seed data live in `lib/product-groups/` so both tabs read one definition.
- **Listings**: one row per product with both channels' status side by side, and a
  detail view putting the two listings in two columns — same fields, same order, same
  scale, because the comparison is the feature. Amazon suppression codes are translated
  to plain English with the raw code kept in the tooltip for support. Read-only, and the
  header says so.
- The unlinked panel distinguishes three confidence cases: a barcode match is certain, a
  title match above the spec's 85% threshold is offered for confirmation with its score,
  and below that no suggestion is shown at all — a wrong link merges two products'
  inventory. The confirm control is absent rather than inert, there being no write
  endpoint yet.
- **Inventory** gains a second grain without losing the first: by product, every source's
  stock shown separately rather than summed.

## 0.1.17 — 2026-09-07

Four new workspaces built against mock data, plus the shared pieces they needed.

- **Profitability** — P&L table and buy-box panel, with `lib/profitability/`
  types, mock data and presentation.
- **Ratings** — ratings workspace, review rows, rating stars and the add-ops-note
  panel, with `lib/ratings/` types, mock data and presentation.
- **Shipping** — page, late-shipment rows and handling-time chart, with
  `lib/shipping/` types, mock data and presentation.
- **Support** — support workspace, case rows, case panel and add-case panel, with
  `lib/support/` cases, draft, types and mock data.
- Shared: the `slide-over` data component, sidebar entries for the new tabs,
  `lib/dates.ts`, and Ask Alaiy suggestions for the new routes.
- Home page updated for the new rail.
- Tooling: pnpm workspace and lockfile, `.claude/launch.json`.

## 0.1.16 — 2026-09-07

**Account Health: how close the Amazon account is to a suspension**

- Seller Central shows the metric; it does not say how much room is left, which orders
  are spending it, or where Late Shipment Rate lands if the unshipped orders go out
  late. That arithmetic is the tab.
- Each tile carries the value, Amazon's limit and the room between them. Headroom is
  signed consistently by the backend, so the tab never has to explain that `+0.3` is
  good on Order Defect Rate and bad on Valid Tracking Rate. A metric Amazon did not
  report reads "not reported", never zero.
- The banner shows proximity, not just breach — "At risk" exists to be seen before
  anything crosses — and distinguishes "connected but never synced" from "healthy".
- The trend is small multiples, each panel with its own scale and threshold line, drawn
  in inline SVG. ODR lives near 1% and VTR near 97%; one shared y-axis would flatten the
  metric most likely to suspend an account. Four `path` sparklines keep the tab
  server-rendered with no chart library.
- Amazon-only, labelled in the header as a decision rather than left as an apparent gap:
  Shopify has no account-suspension mechanism. Still a primary row in the rail.

## 0.1.15 — 2026-09-07

**The glance gets its own route**

- Stacking the tiles under Ask Alaiy put the numbers below the fold on the one screen
  whose job is to be read at a glance. The dashboard is now `/dashboard`, and Home goes
  back to being the question box, byte for byte.
- Two rows in the rail, two entry points. The docked Ask panel comes along on the
  Dashboard as on every data tab, so a question about a number is still one click from
  the number.
- Tiles, alert bar, orders snippet and sync line are unchanged — moved from
  `(app)/home/` to `(app)/dashboard/`, and alert presentation from `lib/home/` to
  `lib/dashboard/`.
- Dashboard is second in the rail: Home is where a seller lands, and someone who wants
  the numbers shouldn't have to pass through a transcript to reach them.

## 0.1.14 — 2026-09-07

**Home: sixty seconds of orientation, under the conversation**

- Ask Alaiy stays at the top; under it four figures, up to three things Alaiy noticed,
  the last ten orders, and when each channel was last pulled.
- The chat is held to a bounded height rather than the viewport's, so the top of the
  dashboard shows — which is also what says there is more.
- Each tile states the window it is measured over: GMV and orders are today so far, the
  return rate is a rolling week, and unsettled is an em dash because settlements aren't
  synced — a zero would read as "you have been paid everything".
- A delta is coloured by whether that direction is *good*, and the label always carries
  the sign, so colour is reinforcement and never the only reading. No baseline means no
  arrow and no percentage claimed.
- The alert bar renders what the backend detected, ranked and capped there. It is the
  one client component on the screen, because dismissing an alert has to hide its row
  before the round trip finishes.

## 0.1.13 — 2026-09-04

**Orders: the ones that have gone wrong, at the top**

- A row is now an order rather than an order *line*, and the orders needing attention
  are the first thing on screen.
- Five backend-computed flags carry the tab: unfulfillable, payment pending past its
  threshold, unshipped past its threshold, refunded, cancelled. They are the first
  vocabulary the two channels share, which is why there is a flag filter and still no
  status filter.
- Channel tabs, because switching channel is the most frequent move on this screen.
- Totals are for the *filtered* view off the same query as the rows, so header and table
  cannot disagree. The attention count is scoped to channel and period rather than to
  the flag filter, so using it as a filter doesn't change it.
- A detail panel that stops at Ask Alaiy's edge, both reading their width from one
  token. CSV export re-reads the same query parameters as the page, so the file is what
  is on screen.

## 0.1.12 — 2026-09-04

**The design system, applied to the product**

- Paper is the ground, navy carries every panel and every word, blue is the one accent,
  and there is one button shape. Tokens in `globals.css` are derived from those four
  values.
- Every radius step collapses to 5px, so a stray `rounded-2xl` cannot reintroduce a
  second shape language. `rounded-full` survives on seven genuine circles.
- The five blurred shadows are gone. One shadow — the press's hard, unblurred block —
  and a card gets a 1px line instead, which works because paper is not white.
- The grain is a fixed `body::before` at 5%, above the app's z-indexes, so a dialog
  can't lose it and look like a different product.
- Buttons lose `primary`/`secondary`/`accent` for one shape and a `ground`. Nothing is
  filled, so nothing is ranked — Connect and Cancel no longer have a loud one and a
  quiet one. The hand-rolled button copies in the connect rows, channel card, toolbar,
  pagination and session rail all route through it.
- Playfair Display joins as the display face, default for `h1`–`h4` on a six-step named
  scale; no arbitrary pixel headings remain. Geist Mono removed as unused.
- Three deliberate departures from the system are argued in `DESIGN.md`, including a
  narrow surviving status palette.

## 0.1.11 — 2026-09-03

**The conversation, made to look like the product**

- Two compositions, one component. An empty conversation on Home is the first screen of
  the product, composed as one: the mark on its accent halo, "Ask Alaiy", Alaiy's read
  of the seller's own figures, the prompt lifted on `shadow-hero`, and four questions
  worth asking as cards, centred in the viewport. Once there is something to read the
  composition inverts — transcript above, prompt docked below. `centred` is that switch,
  and no behaviour turns on it: same state, same poll, same cursor rule.
- The composer is one element placed into whichever composition is on screen. It
  remounts on the switch, which costs nothing — by then the field is disabled and has
  lost focus.
- Alaiy's turns get the mark in their own gutter, so an answer reads like an answer.

**No focus ring inside the prompt**

- The app's focus ring was landing on the field inside the bordered pill, tracing square
  edges a few pixels inside the rounded ones and reading as a rendering fault. The pill
  takes the focus state now — border to `highlight-500` plus an accent glow — and the
  field opts out via one named, explained exception in `globals.css`. Every other
  control keeps its ring, including the send button, where the box *is* the control.

## 0.1.10 — 2026-09-03

**Ask Alaiy answers**

- Home is the conversation, with the seller's past chats beside it; the docked panel on
  the data tabs is the same conversation rather than a second one. The composer accepts
  a question, the answer streams in, and the tools it used are shown.
- Chats and sessions are per user without storing anything new: `OS Chat Session` and
  `OS Chat Message` grant role `All` only `if_owner`, and every call carries the seller's
  own ERPNext token — so asking for someone else's transcript is a `PermissionError`
  from the backend, not a filtered empty result. No workspace parameter to pass and
  nothing in this app to keep in step.
- The tools the assistant answers with come from the API app's `chat_tool_sources` hook,
  scoped to the caller's workspace.
- **The cursor rule**: polling asks for `partial=1`, so the feed carries the message
  being written, re-sent longer each time. A client that advances to the highest seq it
  saw steps past the partial row and leaves a truncated answer on screen permanently.
  So the cursor advances past *complete* messages only, and the partial is held
  separately and redrawn. The test stub honours `after` and re-sends the partial at the
  same seq, so a wrong cursor fails the suite.

## 0.1.9 — 2026-09-03

**Drop the wave footer**

- Removed from all four surfaces it sat on — sign-in's navy panel and its narrow-screen
  form, the onboarding chrome, Home, and the foot of the navy rail — and the component
  with it.
- The positioning goes too: the `relative` and `overflow-hidden` each wave required on
  its container, and the `relative` its siblings carried to sit above it. Left behind,
  those quietly change how something else lays out months later.
- Nothing replaces it. The palette, Poppins, the pills and the status colours are
  untouched.

## 0.1.8 — 2026-09-03

**The landing page's brand, brought into the product**

- os.alaiy.com and the app looked like two products. This makes them one: Poppins, the
  navy and light blue from the landing page's own tokens, its layered wave, its pill
  CTAs, and the bright emerald/amber/orange status palette for
  healthy/reorder/at-risk.
- **Two registers, on purpose.** Poppins carries the chrome — headings, nav, buttons,
  labels, onboarding. Geist carries the data: at 12–13px Poppins is wider and looser,
  and a seller scanning a thousand order lines needs the narrower face. That is the
  `font-data` token, defaulting to tabular numerals, because Poppins sets figures
  proportionally and a money column then shifts under its own alignment.
- The same split governs colour. Chrome is bright: navy rail with an accent-blue active
  row, waves on sign-in, onboarding and Home, accent plates on the one action a screen
  wants taken. Table bodies stay white so the numbers stay readable.
- Where the landing page's hex comments and its `oklch()` values disagree, these are
  keyed on the hexes it names — following the `oklch` literally would have made the app
  *duller* than the accent it replaces.

## 0.1.7 — 2026-09-03

**One step to connect, a Connect button per connector**

- Picking channels and connecting them were two screens asking the same question twice,
  and the first answer was never read: `selected_channels` was written and nothing
  consulted it, because `imports.start` derives its channels from the connections that
  actually exist. Connecting is the only answer that matters, so the flow asks once.
- Every connector gets a row with its action on the right, and the rows say how each
  channel actually connects rather than pretending they're alike: Amazon is OAuth, so
  its button leaves for Seller Central; Shopify in V1 is a pasted private-app token, so
  its button opens two fields below it. BigCommerce, WooCommerce and Unicommerce are
  listed and marked Soon — as a footnote they read as unsupported rather than not-yet.
- Amazon keeps its region select, inline beside the button: consent starts on a
  region-specific Seller Central domain, and there's nothing to guess it from before the
  seller is authorised.
- `effectiveStep` now maps the retired `channels` step onto `connect` alongside
  `import` → `done`; without it a cookie naming either is redirected to a 404 with no
  way out but clearing it.

## 0.1.6 — 2026-09-03

**Land on Ask Alaiy and watch the import from the corner**

- Onboarding no longer ends on a progress screen the seller has to sit on. It ends when
  the import is queued: they go straight to Ask Alaiy, and the import reports itself from
  a status box in the bottom right.
- The box lives in the app layout, not on a page, so its poll survives navigation
  between tabs. On finish it calls `router.refresh()` — everything rendered while it ran
  is stale at that moment — then gets out of the way.
- It expands, and a failure expands itself. With `/onboarding/import` deleted this is
  the only progress surface, so the per-channel breakdown and any error have nowhere
  else to go.
- Ask Alaiy was already disabled; what changes is the reason given. "Still importing
  your data" is about their account and takes precedence over the standing note about
  the query layer, which is about the product.
- Orders and Inventory show their rows with a banner rather than an importing state.
  Rows land as they're fetched, so a seller mid-import has data worth looking at; the
  banner only says not to read the totals as final.
- Sessions issued before this said `onboardingStep: "import"` and would have been
  redirected to a route that no longer exists; `effectiveStep` handles them.

## 0.1.5 — 2026-09-03

**Don't report a failed check as an unconfigured bench**

- The connect page collapsed any failure of the Amazon readiness check into
  `ready: false`, which renders as "Amazon isn't configured on this environment yet" —
  a specific, confident, and in this case wrong diagnosis. It was shown on os.alaiy.com
  while all four SP-API credentials were correctly set; the real cause was a 500 from a
  version skew between this app and the connector.
- The promise is settled rather than caught to a value. A failed check now says "we
  couldn't check whether Amazon is available right now — this is on our side", and the
  not-configured copy is kept for an actual answer of `ready: false`. The unavailable
  branch is tested first, so "we could not check" can never be reported as "it is not
  set up".

**Don't make a returning seller do onboarding again**

- `establishSession` derived the step from `profile_complete`, which can only say
  "profile" or "channels" — no value meant finished. Signing out and back in restarted
  the flow: channel selection, connection, and a second 90-day import.
- `finishOnboardingAction` only ever wrote the session cookie, the copy that dies with
  the browser. It now persists to the workspace first and lets the session follow. A
  failed write keeps the seller where they are rather than letting them through on a
  claim that would evaporate.
- Existing cookies say "channels" while the backend says done, which is a loop: `/home`
  bounces to `/onboarding`, and the onboarding layout knows better but cannot write a
  cookie. Hence `/api/auth/refresh` — the layout sends the browser there, it re-reads
  the workspace, rewrites the session and continues. It validates `next` as a path
  within this app so it cannot become an open redirect, and leaves the step untouched
  when the backend is unreachable rather than promoting someone past a step they haven't
  finished.
- The onboarding layout now refuses to render the flow to anyone already through it.
- `finishOnboardingAction` returns a `FormState` now that it can fail.

## 0.1.4 — 2026-09-02

- **Hide the Ask panel** — layout fix.

## 0.1.3 — 2026-09-02

**The P1 core tabs — Home as Ask, Orders, Inventory, Channels**

- Home is Ask Alaiy and nothing else. The 2×4 dashboard grid is gone; the first screen
  after onboarding is the centred question box with that route's suggestions under it.
  The tiles' figures still build Alaiy's opening line, so the screen opens with
  something true about this seller's own data, but the tile components are deleted.
  `api.dashboard.tiles` and the `DashboardTiles` type stay for whatever brings a
  dashboard back.
- Ask Alaiy stays inert on purpose — the prompt is disabled and says so in both places
  it appears, because the query layer is P2. The composer is one shared component, and
  server-safe as a result. The docked panel hides itself on `/home`, that route *being*
  the Ask surface.
- Orders and Inventory are real listings over the endpoints the connector already
  exposes. Filters, sort column and offset all live in the query string: filtering is a
  GET form via `next/form`, sorting and paging are links. The server does the querying,
  the back button behaves, and a narrowed-down view can be pasted to someone else. No
  client state holds a second copy of the rows. Offsets and sort fields are validated
  against a known set here as well as on the backend, so a hand-edited URL never becomes
  a request.
- Both tables show each channel's status text unmapped and offer no filter over it:
  Shopify says `UNFULFILLED` where Amazon says `AFN` — its fulfilment *channel*, not a
  status — so a shared green "good" state would assert something neither channel said.
  What is filterable is what both define the same way: channel, search, and a date
  window on orders.

## 0.1.2 — 2026-09-02

**Dashboard tiles and the persistent Ask Alaiy panel**

- P1's shell. The signed-in area moves into a route group so the Ask Alaiy panel lives
  in a layout rather than on each page — it has to survive navigation between tabs,
  which is the whole point of "persistent on every screen".
- Home is the spec's 2×4 grid: four fixed tiles above, four open slots below. Each fixed
  tile carries its comparison against the preceding window of equal length, coloured by
  what the movement means rather than by its sign — GMV up is good, return rate up is
  not.
- Three places where honest rendering took more thought: unsettled amount has no data
  source yet, so it keeps its position and says why it is empty (a zero would read as
  "you are all settled up"); no baseline gives "no prior data" with no arrow, not
  "+0.0%"; rate movements are labelled in pp, not %.
- Ask Alaiy is the panel, not the brain: persistence across tabs, expand-to-full-screen,
  Escape to exit, and context-aware suggestions keyed by route for the tabs that don't
  exist yet. The composer is disabled and explains itself — the alternative was a field
  that accepts a question and then apologises. Its opening message is real, built from
  the seller's own tile figures.

## 0.1.1 — 2026-09-02

First release. Project scaffolded from Create Next App.

**P0 auth and onboarding**

- Google-or-email sign-in, the five-step onboarding flow, channel connection, and the
  90-day import progress screen.
- **The browser never talks to the backend.** Every call to api.os.alaiy.com is made
  from the Next.js server; the browser only ever talks to its own origin — Server
  Actions and Route Handlers — which call through on its behalf. That is why there is no
  CORS config anywhere and no environment variable prefixed `NEXT_PUBLIC_`.
  `src/lib/env.ts` and everything under `src/lib/backend/` import `server-only`, so
  importing one from a Client Component is a build error rather than a silent credential
  leak. `src/lib/backend/client.ts` is the single module that knows the backend URL.
- **Auth.** No passwords — email + OTP, with a fresh code every login. The session is a
  stateless JWT (jose, HS256) in an httpOnly, sameSite=lax cookie carrying the user,
  their ERPNext Company, tier, and onboarding position. Protection is two layers on
  purpose: `src/proxy.ts` (Next 16's rename of middleware) does optimistic redirects and
  is explicitly *not* the authorisation boundary; `src/lib/auth/dal.ts` is, and every
  page and Server Action re-verifies through it.
- **Channel connection.** Channel credentials never enter this app's environment.
  Amazon's whole OAuth flow runs on the ERPNext bench, which holds the LWA client
  secret, so this app only fetches a consent URL and redirects.

**Surface real backend errors instead of a generic fallback**

- Signing up on os.alaiy.com/start showed "We couldn't send your code. Try again." The
  real cause was a 501 `OutgoingEmailError` — prod has no default outgoing Email Account
  — and nothing in this app recorded or revealed it. Retrying was never going to work,
  and the message said to.
- `extractMessage` never read Frappe's `_server_messages`, where the human-readable
  error actually lives, so *every* backend error collapsed to a fallback, including 4xx
  errors we do want to show. It now parses that (and `exc_type`), strips markup and
  unescapes entities.
- Nothing logged the cause; a swallowed 5xx left no trace, which is why diagnosing this
  needed a manual curl against prod. The backend client now logs method, path, status
  and message server-side before throwing, while the user still sees only a sanitised
  message.
- The fallback copy no longer promises that retrying will help. Server-side faults say
  so plainly.
- Collapses the `messageFor` helper duplicated in both action files into
  `src/lib/backend/errors.ts`.
