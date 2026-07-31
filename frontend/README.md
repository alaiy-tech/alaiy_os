# Alaiy OS Dashboard (frontend)

A standalone React SPA for `alaiy_os`, talking to Frappe as a same-origin
REST API. This is **not** the Frappe desk - it's an additive custom
dashboard served at `/os/`. The existing desk customization (custom
sidebar/theme, the desk "Ask Alaiy" page, `/` → `/desk/ask-alaiy`) is
untouched and keeps working as before.

Stack: React + TypeScript, Vite, pnpm, TanStack Query, `frappe-react-sdk`,
shadcn/ui (Tailwind), React Router. Session/cookie auth against Frappe's
own login - no separate token layer. Light mode only.

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
change** the moment a mutation (create/update/delete) is added; see the note
in `docs/adding-a-screen.md`'s follow-ups if you're the one adding it.

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

- `src/config/navigation.ts` - the entire sidebar, as data. Add an item here
  and it's routable immediately (as "Coming soon" until you build it).
- `src/components/data/DataTable.tsx`, `DetailView.tsx` - generic, reusable
  list/detail primitives every doctype screen plugs into.
- `src/features/<doctype>/` - the three real screens (Item → Products, Sales
  Order, Customer) as the reference pattern.
- `src/hooks/use-doctype-list.ts` - shared pagination/search state, wraps
  `frappe-react-sdk`'s `useFrappeGetDocList`.
- `src/components/layout/` - the dashboard shell: collapsible icon-rail
  sidebar, top bar, Ctrl+K command palette.
- `alaiy_os/alaiy_os/hooks.py`'s `website_route_rules` - maps deep links
  under `/os/*` back to this app's `index.html` for client-side routing.

See [`docs/adding-a-screen.md`](docs/adding-a-screen.md) for the full
walkthrough of turning a "Coming soon" placeholder into a real screen.

## Known limitations of this pass

- Read-only: list + detail only, no create/edit/delete UI yet.
- Only Products (Item), Sales Order, and Customer are wired to live data;
  everything else in the sidebar is a "Coming soon" placeholder.
- The field lists used in the 3 real screens were chosen from ERPNext's
  standard Item/Sales Order/Customer schema, not introspected from the live
  bench - double-check against **Customize Form** if this bench has any
  custom field renames.
- Notifications in the top bar are a UI stub (no backend wiring).
- The production JS bundle is ~520KB (not yet code-split) - fine for this
  pass, worth revisiting with route-level `lazy()` if the app grows.
