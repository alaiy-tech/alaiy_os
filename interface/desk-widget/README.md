# Ask Alaiy widget

A floating launcher + panel (React) for Ask Alaiy, injected into every Frappe
Desk page via `app_include_js`/`app_include_css` (see `alaiy_os/hooks.py`).
It's a companion to the desk's own `alaiy_os/alaiy_os/page/ask_alaiy/
ask_alaiy.js` -- both talk to the same `alaiy_os.api.chat` backend (see
`alaiy_os/chat/CHAT.md`), so a conversation looks the same everywhere. This
one is reachable from any page without navigating away from it.

## Why this isn't built like `interface/` or `alaiy_os_globali/frontend/`

Those are standalone apps with their own origin, router, and design system,
so they need a BFF proxy layer and a full component library. This widget is
injected straight into an already-authenticated Desk page -- there's no
separate origin to bridge (it calls Frappe with the same `frappe.xcall` the
desk's own JS uses) and no router (it's one global overlay, not a set of
routes). It ships as one self-contained IIFE bundle with its own plain CSS,
themed off Frappe Desk's own CSS custom properties
(`apps/frappe/frappe/public/scss/common/css_variables.scss`) rather than a
Tailwind config, so it gets Desk's light/dark theme for free without owning
any of its own tokens.

## Building

```bash
cd apps/alaiy_os/interface/desk-widget
npm install
npm run build      # -> ../../alaiy_os/public/dist/ask_alaiy.{js,css}
```

No `bench build` step needed -- Frappe serves anything under an app's
`public/` folder as a static asset automatically. After building, a
`bench --site <site> clear-cache` picks up a `hooks.py` change if you also
edited the include list; the built files themselves are served immediately.

## Developing

```bash
npm run dev
```

Runs a plain Vite dev server (default port from `vite.config.ts`) for fast
iteration on components in isolation. It does **not** run inside Desk --
there's no dev-mode HMR wired into a live Desk page. Iterating against a real
conversation means rebuilding (`npm run build`) and reloading Desk.

## What's simplified vs. the `alaiy_os_globali` reference

This widget was ported from `alaiy_os_globali/frontend/src/components/
askAlaiy/`, the most complete existing implementation (see
`ASK_ALAIY_ARCHITECTURE.md` at the bench root). Trimmed for a first version:

- **Fixed panel width**, not resizable/persisted -- the reference's drag
  handle wasn't ported.
- **No PNG chart export** -- CSV export and the chart/table toggle are still
  here; the canvas-based PNG export button was dropped.
- **Fixed-position overlay**, not layout-push -- it slides in over Desk's own
  content rather than shrinking it, so it never has to reach into Desk's own
  DOM/layout.

Everything else -- streaming with the character-reveal animation, skills
(`/`), mentions (`@`), attachments (uploads and generated-file artifacts),
the `alaiy-chart` fence convention, and the hidden-during-run tool trail --
is ported faithfully.
