# interface — notes for AI tools

The Next.js front end for Alaiy OS. Read the relevant doc below **before**
writing a page or a component; they exist so generated code matches what is
already here instead of inventing a parallel convention.

## Read first

| Doc | When |
|---|---|
| [DESIGN.md](./DESIGN.md) | **Any UI work.** Colour tokens, typography, status pills, page layout, list/detail/tree patterns, spacing, motion. Non-optional for anything visual. |
| [PATH.md](./PATH.md) | Adding, moving, or linking a route. Full URL inventory. |
| [CONNECTOR_TO_BASE_UI_COMPOSITION.md](./CONNECTOR_TO_BASE_UI_COMPOSITION.md) | Building a connector's UI on the shared primitives. |
| [public/assets/README.md](./public/assets/README.md) | Touching a logo, icon, or image. |

## Stack

Next.js 16 App Router · React 19 (React Compiler on) · TypeScript ·
Tailwind v4 · shadcn + Base UI + Radix primitives · TanStack Table ·
Zustand · Biome. Data comes from Frappe through `src/lib/frappe/`.

## Conventions that bite

- **Tailwind v4, no `tailwind.config.ts`.** The theme is `@theme inline` in
  `src/app/globals.css`. A CSS variable is not a utility until it is mapped
  there. Leave the `source(none)` / `@source` lines alone — the comment above
  them explains what breaks.
- **Never hard-code a colour.** Use the semantic tokens in DESIGN.md. The app
  ships 5 theme presets × light/dark × 18 fonts and every page must survive all
  of them.
- **`--accent` is a neutral hover surface, not the brand colour.** Brand navy is
  `--primary`; brand blue is `--ring` (focus rings only).
- **`"use no memo"` is required** in any component that touches a TanStack
  Table or `@headless-tree` instance — **including one received as a prop**,
  not just the component calling the hook. React Compiler caches on reference
  identity and those instances mutate in place, so without the directive the
  subtree never re-renders: a table or tree stays permanently empty, and a
  child reading `table.getState()` is pinned to whatever it saw on the first
  render (see #206).
- **Status colours live in `src/constants/<entity>.ts`**, never inline, and
  always with a neutral `DEFAULT_*_BADGE_CLASS` fallback so an unrecognised
  status from a client site degrades to a grey pill.
- **Dark mode is the `.dark` class**, applied pre-paint by `ThemeBootScript`.
  Never write a `prefers-color-scheme` media query — it would override the
  user's explicit choice.
- **Route-level constants** (paths, `href()` helpers, doctype names, default
  columns) belong in `src/constants/`, not in components.
- Server Components by default; add `"use client"` only where state or effects
  demand it. `page.tsx` files stay thin and delegate to `_components/`.

## Commands

Run from `interface/`:

```bash
npm run dev              # next dev
npm run build            # next build
npm run check            # biome lint + format check
npm run check:fix        # biome, writing fixes
npm run generate:presets # regenerate THEME_PRESET_OPTIONS after adding a preset CSS file
```

**Use npm.** Both `package-lock.json` and `pnpm-lock.yaml` are committed, but
deployments run `npm ci`, so `package-lock.json` is the lockfile that decides
what ships. A dependency change must update it.

`lint-staged` runs `biome check --write` on staged JS/TS via husky, so match the
existing formatting rather than reformatting files you did not otherwise touch.

## Before proposing a change

The code is not uniform, and the known gaps are already filed under the
[`design-system`](https://github.com/alaiy-tech/alaiy_os/labels/design-system)
label — a dead sidebar token in the `alaiy-os` preset, a 404ing background
image, status colours that no preset can restyle, two different page-title
sizes, and more. Check that label before "fixing" something that looks wrong:
it is probably known, with the reasoning and intended fix written down, and
some of it is deliberately deferred pending design sign-off.

Do not copy those patterns forward into new code — follow DESIGN.md, which
describes the intended rule rather than the current average.
