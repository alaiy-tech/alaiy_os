# Brand and icon assets

Everything under `public/` is served from the site root, so
`public/assets/images/logo-hor.png` is `/assets/images/logo-hor.png` in a
`src` attribute. Paths are absolute from the root — never relative.

Colour tokens, typography, and component rules are in
[../../DESIGN.md](../../DESIGN.md).

## Two logos, on purpose

| Prefix | Meaning |
|---|---|
| `logo-*` | **Alaiy OS's own** mark. Product surfaces: the loading screen, the sign-in page. |
| `client-logo-*` | The **deploying client's** mark, overridden per client deployment. The in-app sidebar, so a client sees their own brand once signed in. |

A client app (`alaiy_os_<client>`) replaces the `client-logo-*` files and leaves
`logo-*` alone. Keep the two prefixes distinct — collapsing them into one
`logo.svg` would remove the ability to white-label the app shell.

## Current slots

| File | Format | Dimensions | Consumed by |
|---|---|---|---|
| `images/logo-hor.png` | PNG, transparent | 427 × 128 | [`src/app/(main)/auth/layout.tsx`](<../../src/app/(main)/auth/layout.tsx>) — sign-in panel, rendered at 175 × 35 and forced to white with `brightness-0 invert` |
| `images/logo-square.png` | PNG, transparent | 512 × 512 | [`src/app/loading.tsx`](../../src/app/loading.tsx) — route-loading splash, rendered at 64 × 64 with `animate-pulse` |
| `images/client-logo-hor.png` | PNG, transparent | 427 × 128 | [`src/components/layout/app-sidebar.tsx`](../../src/components/layout/app-sidebar.tsx) — sidebar header, rendered at 87.5 × 17.5 |
| `images/client-logo-square.png` | PNG, transparent | 512 × 512 | **Nothing.** See [Open slots](#open-slots). |
| `images/favicon/icon.png` | PNG, opaque | 512 × 512 | [`src/app/layout.tsx`](../../src/app/layout.tsx) via `metadata.icons.icon` |
| `images/wave.svg` | SVG | — | [`ask-alaiy-background.tsx`](<../../src/app/(main)/os/ask-alaiy/_components/ask-alaiy-background.tsx>) — **but the path is wrong, see below** |

## Open slots

Not yet available. Filenames, formats, and dimensions are fixed here so the
design team can drop files in and the wiring is a one-line change. Each needs
design ownership before it lands.

| File | Format | Dimensions | Why it is wanted |
|---|---|---|---|
| `images/logo-mark.png` | PNG, transparent | 512 × 512 | Icon-only Alaiy mark for the **collapsed sidebar**. The sidebar narrows to `3rem` in `icon` mode (the default) and currently keeps showing the full horizontal logo, which is unreadable at that width. A `client-logo-mark.png` counterpart is wanted for the same reason. |
| `og-image.png` | PNG | 1200 × 630 | Open Graph / social share card. `metadata` in `src/app/layout.tsx` sets no `openGraph.images`, so a shared link previews blank. |
| `images/favicon/icon.svg` | SVG | square, ≥ 32 safe | Vector favicon, for crisp rendering on hi-dpi tabs alongside the existing PNG. |
| `images/favicon/apple-icon.png` | PNG, opaque | 180 × 180 | iOS home-screen icon. Next.js picks it up from `metadata.icons.apple`. |

### Why PNG and not SVG

The four live logos are PNG because that is what the design team supplied. SVG
would be better — it scales for free and the collapsed-sidebar mark needs to be
legible at 24px — so **prefer SVG for anything new**, and treat replacing the
existing PNGs with SVGs as a welcome change rather than a required one. If a
logo is replaced with an SVG, update the `src` in the consuming file listed
above; the `width`/`height` props can stay.

## Known issues

- **`wave.svg` is unreachable.** `ask-alaiy-background.tsx` requests
  `/wave.svg`, but the file is at `/assets/images/wave.svg` and no
  `public/wave.svg` exists — the Ask Alaiy background has never rendered. Fix
  is a one-line path correction in that component (tracked in
  [DESIGN.md § Known divergences](../../DESIGN.md#known-divergences)).
- **`client-logo-square.png` is unused.** It is the square counterpart to the
  sidebar's horizontal client logo and is the natural source for the
  `client-logo-mark` slot above. Either wire it up or drop it — right now it is
  512 × 512 of dead weight in every build.

## Adding an asset

1. Put it under `images/` (or `images/favicon/` for icons) using the
   `logo-*` / `client-logo-*` prefix convention.
2. Add a row to [Current slots](#current-slots) naming the file that consumes
   it. An asset with no consumer belongs in [Open slots](#open-slots) instead.
3. Reference it by an absolute path (`/assets/images/…`).
4. Give every meaningful image real `alt` text; use `alt=""` only for
   decoration, as `ask-alaiy-background.tsx` correctly does.
5. Keep logos transparent so they work against `--background`, `--sidebar`, and
   every theme preset. Check both light and dark mode before committing —
   a mark with baked-in white will show a box in dark mode.
6. Note that the sign-in panel recolours `logo-hor.png` to solid white via
   `brightness-0 invert` to sit on `bg-primary`. That trick only works on a
   single-colour dark mark; a multi-colour logo will flatten to a white
   silhouette there.
