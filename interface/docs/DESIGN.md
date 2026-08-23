# Design system

What a page in the `interface` app is allowed to look like, and which token or
component it must reach for to look that way.

The source of truth is the code, not this file: tokens are declared in
`src/app/globals.css` and the four preset files under `src/styles/presets/`,
primitives live in `src/components/primitive/`, and the status colour maps live in
`src/constants/`. This document records what those files currently say and why,
so a new page can match the existing ones without reverse-engineering them
first.

Where the code is inconsistent with itself, the cleanup is tracked as an issue
under the [`design-system`](https://github.com/alaiy-tech/alaiy_os/labels/design-system)
label rather than described here, so this file stays a statement of the rule
rather than a to-do list. Check that label before "fixing" something that looks
wrong — it is probably already filed, with the reasoning and the intended fix.

Route inventory is in [PATH.md](./PATH.md). Composing a connector's UI on top of
these primitives is in
[CONNECTOR_TO_BASE_UI_COMPOSITION.md](./CONNECTOR_TO_BASE_UI_COMPOSITION.md).

## Contents

- [Where the theme lives](#where-the-theme-lives)
- [Colour tokens](#colour-tokens)
- [Theme presets](#theme-presets)
- [Typography](#typography)
- [Status pills / badges](#status-pills--badges)
- [Page layout anatomy](#page-layout-anatomy)
- [Component patterns](#component-patterns)
- [Spacing & grid](#spacing--grid)
- [Radius, ring, shadow](#radius-ring-shadow)
- [Motion](#motion)

## Where the theme lives

Tailwind v4. **There is no `tailwind.config.ts`** — anything that would have
gone in one is CSS in `src/app/globals.css`:

| Concern | Declared in |
|---|---|
| Utility ↔ token mapping | `@theme inline { … }` in `globals.css` |
| Default light values | `:root { … }` in `globals.css` |
| Default dark values | `.dark { … }` in `globals.css` |
| Per-preset overrides | `:root[data-theme-preset="<name>"]` in `src/styles/presets/<name>.css` |
| Per-preset dark overrides | `.dark:root[data-theme-preset="<name>"]` in the same file |
| Font-family switching | `html[data-font="<key>"] body` blocks in `globals.css`, keys from `src/config/fonts.ts` |

Two rules follow from this that are easy to trip over:

1. **A token only becomes a utility if `@theme inline` maps it.** Declaring
   `--foo` in a preset does nothing on its own; `bg-foo` needs
   `--color-foo: var(--foo)` inside `@theme inline`. Getting this wrong fails
   silently — the utility resolves to whatever the default theme says, with no
   error and nothing in the diff to notice. The `alaiy-os` preset shipped its
   sidebar as `--sidebar-background` for exactly this reason and rendered the
   default near-white until #192; check the `@theme inline` block before adding
   or renaming a token.
2. **Dark mode is a class, not a media query** —
   `@custom-variant dark (&:is(.dark *))`. The `dark:` prefix keys off a `.dark`
   ancestor, which `ThemeBootScript` (`src/scripts/theme-boot.tsx`) sets before
   paint from the `theme_mode` cookie. Never write
   `@media (prefers-color-scheme: dark)` here; it would ignore the user's
   explicit choice.

Tailwind's source scanning is pinned deliberately:

```css
@import "tailwindcss" source(none);
@source "../**/*.{ts,tsx}";
```

Automatic detection crawls the project and skips whatever git ignores, which
makes the generated CSS depend on where the tree is checked out — under
`devbench/builds` it reads Turbopack's binary cache and emits CSS that fails to
parse. Leave the explicit `@source` alone. The long comment at the top of
`globals.css` has the full story.

Preferences that change the look are all in
`src/lib/preferences/preferences-config.ts`, each as an `html[data-*]`
attribute:

| Preference | Attribute | Default | Values |
|---|---|---|---|
| `theme_mode` | `data-theme-mode` | `light` | `light` `dark` `system` |
| `theme_preset` | `data-theme-preset` | `default` | `default` `alaiy-os` `brutalist` `soft-pop` `tangerine` |
| `font` | `data-font` | `geist` | 18 keys from `fonts/registry.ts` |
| `content_layout` | `data-content-layout` | `centered` | `centered` `full-width` |
| `navbar_style` | `data-navbar-style` | `sticky` | `sticky` `scroll` |
| `sidebar_variant` | `data-sidebar-variant` | `sidebar` | `sidebar` `floating` `inset` |
| `sidebar_collapsible` | `data-sidebar-collapsible` | `icon` | `icon` `offcanvas` |

A page must survive every combination. In practice that means: never hard-code a
colour, never assume a font's metrics, and never assume the content column is
full-bleed.

## Colour tokens

Semantic role tokens, shadcn-style. Values below are the **default** preset;
each of the four presets overrides most of them, so treat the values as
illustration and the *role* as the contract.

| Token | Utilities | Light (`:root`) | Dark (`.dark`) | Used for |
|---|---|---|---|---|
| `--background` | `bg-background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page ground. Set on `body`. |
| `--foreground` | `text-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Primary text. |
| `--card` | `bg-card` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Card / panel surface. |
| `--card-foreground` | `text-card-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text on cards. |
| `--popover` | `bg-popover` | `oklch(1 0 0)` | `oklch(0.205 0 0)` | Popover, dropdown, command palette surface. |
| `--popover-foreground` | `text-popover-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Text in popovers. |
| `--primary` | `bg-primary` `text-primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | Primary button fill, active column-resize handle, link colour. |
| `--primary-foreground` | `text-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | Text on `--primary`. |
| `--secondary` | `bg-secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary button fill. |
| `--secondary-foreground` | `text-secondary-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text on `--secondary`. |
| `--muted` | `bg-muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Neutral fill: row hover (`bg-muted/40`), card footer (`bg-muted/50`), neutral pills, empty-state icon chip. |
| `--muted-foreground` | `text-muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary / label text, em-dash placeholders, table empty message. |
| `--accent` | `bg-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Hover/active surface. **Neutral, not a brand colour** — see the note below. |
| `--accent-foreground` | `text-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Text on `--accent`. |
| `--destructive` | `bg-destructive` `text-destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Error, danger, cancelled, overdue. |
| `--info` / `--info-foreground` | `bg-info` `text-info-foreground` | blue-500 / blue-700 | blue-500 / blue-300 | Status tone: in flight. |
| `--success` / `--success-foreground` | `bg-success` `text-success-foreground` | green-500 / green-700 | green-500 / green-300 | Status tone: settled well. |
| `--warning` / `--warning-foreground` | `bg-warning` `text-warning-foreground` | amber-500 / amber-700 | amber-500 / amber-300 | Status tone: needs attention. Also the overdue cell highlight. |
| `--caution` / `--caution-foreground` | `bg-caution` `text-caution-foreground` | orange-500 / orange-700 | orange-500 / orange-300 | Status tone: reversal or exception. |
| `--destructive-foreground` | `text-destructive-foreground` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | Text on a solid `--destructive` fill. Flips light/dark like `--primary-foreground`, because the destructive red is dark in light mode and light in dark mode. |
| `--border` | `border-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Default border. Applied globally via `* { @apply border-border }`. |
| `--input` | `border-input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Form control borders; also `bg-input/30` for dark outline buttons. |
| `--ring` | `ring-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus rings. Global default `outline-ring/50`. |
| `--chart-1` … `--chart-5` | `fill-chart-1`, `stroke-chart-1`, … | greyscale ramp | greyscale ramp | Recharts series, in order. |
| `--sidebar` | `bg-sidebar` | `oklch(0.985 0 0)` | `oklch(0.205 0 0)` | Sidebar ground. |
| `--sidebar-foreground` | `text-sidebar-foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Sidebar text. |
| `--sidebar-primary` | `bg-sidebar-primary` | `oklch(0.205 0 0)` | `oklch(0.488 0.243 264.376)` | Sidebar emphasis. |
| `--sidebar-primary-foreground` | `text-sidebar-primary-foreground` | `oklch(0.985 0 0)` | `oklch(0.985 0 0)` | Text on sidebar emphasis. |
| `--sidebar-accent` | `bg-sidebar-accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | **Active + hover nav item.** |
| `--sidebar-accent-foreground` | `text-sidebar-accent-foreground` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Active nav item text and icon. |
| `--sidebar-border` | `border-sidebar-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Sidebar dividers, rail hover. |
| `--sidebar-ring` | `ring-sidebar-ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus ring inside the sidebar. |
| `--radius` | `rounded-lg` etc. | `0.625rem` | — | Base radius; see [Radius, ring, shadow](#radius-ring-shadow). |
| `--font-sans` | `font-sans` | `var(--font-geist)` | — | Body and heading stack. |
| `--font-mono` | `font-mono` | `var(--font-geist-mono)` | — | Code, IDs, keyboard hints. |

`--font-heading` is mapped in `@theme inline` but aliased straight to
`var(--font-sans)`. `font-heading` therefore renders identically to `font-sans`
today; it exists so a display face can be introduced in one place later. Prefer
it on headings and card titles for that reason.

### `--accent` is not the brand colour

Worth stating outright, because the name misleads and the issue that
commissioned this document assumed otherwise. In shadcn's vocabulary — which
this app follows — `--accent` is the **neutral hover/active surface**, not a
brand hue. The Alaiy brand navy is `--primary`, and the brand blue is `--ring`
(focus rings and chart highlights only). The `alaiy-os` preset's header comment
is explicit that a bright blue hover was removed on purpose: *"accent = a
neutral warm gray (NOT the bright blue — that's reserved for focus rings
only)"*. Do not reintroduce a coloured hover.

### Status tones are tokens, and paired

Each status tone is **two** tokens, not one: `--<tone>` is the fill hue and
`--<tone>-foreground` is the text on it. A pill tints the fill rather than
filling it — `bg-success/10` in light mode, `/15` in dark, because the darker
ground needs a stronger tint to read at the same weight — while the text colour
steps darker in light mode and lighter in dark.

Their values are the Tailwind palette steps the status maps used to hardcode,
so nothing changed on screen when they were introduced. What changed is that a
**preset can now override them**; none does yet, so every preset currently
shows the same status colours.

Never write a raw `bg-green-*` / `bg-amber-*` pair for a status. Use
[`STATUS_TONE`](#the-colour-vocabulary).

## Theme presets

Five choices, from `src/constants/theme.ts`:

| Preset | `data-theme-preset` | `--primary` (light) | Notes |
|---|---|---|---|
| Default | `default` | `oklch(0.205 0 0)` | Greyscale. Declared in `globals.css` itself — there is no `default.css`. |
| Alaiy OS | `alaiy-os` | `oklch(0.3028 0.0765 245.1957)` | Brand navy `#003254`. `--ring` is brand blue `#91D1F2`, `--destructive` is `#B4232A`. `--radius` drops to `0.5rem`. Light-mode only by design: its `.dark` block mirrors the light values and is not a designed dark theme. |
| Brutalist | `brutalist` | `oklch(0.6489 0.237 26.9728)` | Hard-edged shadows. |
| Soft Pop | `soft-pop` | `oklch(0.5106 0.2301 276.9656)` | |
| Tangerine | `tangerine` | `oklch(0.64 0.17 36.44)` | |

`THEME_PRESET_OPTIONS` sits between `--- generated:themePresets:start ---` and
`:end` markers. It is produced by `npm run generate:presets`
(`src/scripts/generate-theme-presets.ts`) from the `label:` / `value:` header
comment in each preset file. **Add a preset by adding a CSS file and
regenerating — never by hand-editing `constants/theme.ts` between the
markers.** New preset files also need an `@import` in `globals.css`.

Presets are the only place shadow tokens are defined. `--shadow-2xs` through
`--shadow-2xl` do not exist in the default theme, and the `@layer utilities`
block in `globals.css` deliberately only applies them under
`[data-theme-preset]:not([data-theme-preset="default"])`.

## Typography

### Font stack

`--font-sans`, defaulting to Geist, resolved through
`html[data-font="<key>"] body`. 18 keys are available from
`src/config/fonts.ts` — `geist` `inter` `notoSans` `nunitoSans` `figtree`
`roboto` `raleway` `dmSans` `publicSans` `outfit` `geistMono`
`geistPixelSquare` `jetBrainsMono` `notoSerif` `robotoSlab` `merriweather`
`lora` `playfairDisplay`. `body` falls back to `system-ui, sans-serif`.

Because the user can pick a serif or a monospace face for body text, **never
size a container to fit a specific string.** Truncate with `truncate` and a
`title` attribute, as the ID and generic text cells do.

### Size scale

Tailwind's default scale. Ranked by how much of the app actually uses each step:

| Step | Size | Where it is used |
|---|---|---|
| `text-xs` | 0.75rem | Badge and pill labels, `SidebarGroupLabel`, `size="sm"` sidebar buttons, captions, `Kbd`. |
| `text-sm` | 0.875rem | **The workhorse.** Body copy, table cells (set once on `Table`), page subtitle, card body, form labels, pagination footer, nav items, `EmptyTitle`. |
| `text-base` | 1rem | `CardTitle`. |
| `text-lg` | 1.125rem | Effectively unused — one occurrence. Don't reach for it. |
| `text-xl` | 1.25rem | Section headings inside dense settings panels. |
| `text-2xl` | 1.5rem | **Every page title**, via `PageHeader`. Also KPI metric values and `not-found` headings. |
| `text-3xl` | 1.875rem | Large KPI figures only (`kpi-strip`, `metric-cards`, `overview-kpis`). Not a page-title size — see `PageHeader`. |
| `text-4xl` | 2.25rem | Ask Alaiy hero, `unauthorized` at `sm:` and up. Nothing else. |

Arbitrary sizes (`text-[10px]`, `[11px]`, `[12px]`, `[13px]`) appear about 17
times, mostly in `Kbd` and dense chart labels. Don't add more; use `text-xs`.

### Weights

| Weight | Use |
|---|---|
| `font-normal` | Default body. |
| `font-medium` | **The default emphasis** — by far the most used. Table headers, badges, buttons, active nav items, ID links, `CardTitle`, KPI figures. |
| `font-semibold` | Page and section headings (`h1`/`h2`). |
| `font-bold` | Auth screens only (`Sign In`, `Unauthorized Access`). Avoid inside the app shell. |

Headings carry `tracking-tight`; large numerics add `leading-none` so a KPI
figure sits tight against its label.

### Numerics

Any figure a user might compare down a column gets `tabular-nums`. `GenericCell`
applies it for `Currency`, `Int`, `Float`, and `Percent`; KPI values do the
same. Currency strings always come from `formatCurrency()` in `@/lib/utils` —
never `toLocaleString` with a hand-written symbol.

In a **table**, those same four fieldtypes are also **right-aligned**, header
and cell together, so `tabular-nums` has an edge to line the digits up against.
The single source of truth is `isNumericFieldtype()` in `src/constants/list.ts`,
which also decides which filter operators a field is offered — so alignment and
filtering can't drift apart. A column builder sets `meta: { align: "right" }`
and the table applies `text-right` to both `TableHead` and `TableCell` from that
one value.

Alignment lives on the **column**, not in `GenericCell`: the same renderer is
used inside detail-page cards and totals panels, where a right-aligned figure
would be wrong.

```tsx
const { defaultCurrency } = useCompany();
formatCurrency(value, { currency: defaultCurrency });
```

`formatCurrency` defaults to `USD` / `en-US` if no currency is passed, which is
wrong for most sites — always pass one. On a detail page the **document's** own
currency wins over the company default, because an order taken in a customer's
currency holds its amounts in that currency; see
`src/app/(main)/os/sales/orders/[id]/page.tsx`.

## Status pills / badges

### The primitive

`Badge` from `src/components/primitive/badge.tsx`. Fixed `h-5`, `rounded-4xl`,
`px-2`, `text-xs font-medium`. For a doctype status, always use
`variant="outline"` and override with the mapped classes:

```tsx
<Badge variant="outline" className={cn("border-0 font-medium", getStatusBadgeClass(status))}>
  {status}
</Badge>
```

`variant="outline"` plus `border-0` is deliberate: it drops the variant's own
background and border so the mapped `bg-*`/`text-*` pair is the only colour,
while keeping the badge's size and radius. The built-in `default`,
`secondary`, and `destructive` variants are for non-status badges (the KPI trend
chip, counts).

### The colour vocabulary

Seven tones, defined once as `STATUS_TONE` in `src/constants/list.ts`. Refer to
them by key — never re-spell the classes, and never invent an eighth tone
without design sign-off.

| `STATUS_TONE` key | Renders | Means |
|---|---|---|
| `neutral` | `bg-muted text-muted-foreground` | Not started, or parked: `Draft`, `Closed`, `Disabled`. The fallback for any unrecognised status. |
| `info` | `bg-info/10 text-info-foreground dark:bg-info/15` | In flight, nothing wrong: `To Deliver`, `To Receive`, `To Bill`, `Template`. |
| `success` | `bg-success/10 …` | Settled well: `Completed`, `Delivered`, `Paid`, `Active`. |
| `warning` | `bg-warning/10 …` | Needs attention, not yet failed: `On Hold`, `Unpaid`. |
| `caution` | `bg-caution/10 …` | Reversal or exception: `Return`, `Credit Note Issued`, `Debit Note Issued`, `To Pay`. |
| `destructive` | `bg-destructive/10 text-destructive` | Failed or void: `Cancelled`, `Overdue`. One token, since the red reads on both grounds. |
| `structural` | raw violet palette pair | Not a lifecycle state but a classification: `Variant`. The one tone with a single call site, so it has no token of its own — promote it if a second use appears. |

### The maps

Each list owns its own map plus a `DEFAULT_*` fallback, and a `getStatusBadgeClass()`
helper that does the lookup. The maps hold `STATUS_TONE` keys, not classes, so
retuning a tone is a one-line change. Two facts drive the remaining duplication:

- **Sales and Purchase vocabularies differ** (`To Deliver` vs `To Receive`), so
  they cannot share one map.
- **The same word means different things across doctypes.** A Sales Order
  `To Bill` is mid-flight and blue; a Sales Invoice `Unpaid` is the one that
  wants attention and is amber. That is why linked-document statuses live in a
  separate `LINKED_DOC_BADGE_CLASS` rather than being merged in.

| Map | File | Applies to |
|---|---|---|
| `STATUS_BADGE_CLASS` | `constants/sales-orders.ts` | Sales Order `status` |
| `LINKED_DOC_BADGE_CLASS` | `constants/sales-orders.ts` | Delivery Note / Sales Invoice on the SO detail page |
| `STATUS_BADGE_CLASS` | `constants/purchase-orders.ts` | Purchase Order `status` |
| `LINKED_DOC_BADGE_CLASS` | `constants/purchase-orders.ts` | Purchase Receipt / Purchase Invoice on the PO detail page |
| `STATUS_BADGE_CLASS` | `constants/products.ts` | Item `Active` / `Template` / `Variant` / `Disabled` |

Sales Order, in full, as the reference:

| Status | Tone |
|---|---|
| `Draft` | Neutral |
| `On Hold` | Amber |
| `To Pay` | Orange |
| `To Deliver and Bill` · `To Deliver` · `To Bill` | Blue |
| `Completed` | Green |
| `Cancelled` | Destructive |
| `Closed` | Neutral |
| *anything else* | Neutral (`DEFAULT_STATUS_BADGE_CLASS`) |

### Adding a status map

1. Cover **every** value the doctype's Select field can hold, not just the ones
   the current site happens to use.
2. Always export a `DEFAULT_*_BADGE_CLASS` neutral fallback and go through a
   `getStatusBadgeClass()`-style helper — a custom status added on a client site
   must render as a plain grey pill, never as a crash or an unstyled string.
3. Pick a tone from the vocabulary above. Don't introduce a seventh hue without
   design sign-off.

## Page layout anatomy

### The shell

`src/app/(main)/os/layout.tsx` wraps every `/os` page:

```
SidebarProvider  (--sidebar-width: 16rem)
├── AppSidebar
└── SidebarInset          peer-data-[variant=inset]:border, min-w-0 overflow-x-clip
    ├── header            h-12, border-b
    │                     [data-navbar-style=sticky] → sticky top-0 z-50
    │                                                   bg-background/50 backdrop-blur-md
    │   ├── left          SidebarTrigger · vertical Separator (h-4) · SearchDialog
    │   └── right         NotificationsPopover · UserMenu   (gap-4)
    └── content           p-4 md:p-6
                          [data-content-layout=centered] → mx-auto w-full max-w-screen-2xl
                          has-data-[content-padding=false] → p-0
```

Notes worth knowing before you fight the layout:

- **Header height** is `h-12` (3rem), also exposed as
  `--dashboard-header-height: --spacing(12)` on the inset for anything that
  needs to offset against it.
- **Content padding** is `p-4` on mobile, `p-6` from `md:`. A full-bleed page
  (a chat, a full-height tree) opts out by putting `data-content-padding="false"`
  on its own root — the parent has `has-data-[content-padding=false]:p-0`. Do
  not add negative margins to escape the padding.
- **`max-w-screen-2xl`** applies in the default `centered` layout. A page must
  not assume it has the whole viewport.
- `min-w-0` and `overflow-x-clip` on the inset are what stop a wide table from
  pushing the sidebar off screen. Keep wide content inside its own
  `overflow-x-auto`, the way `SalesOrderTable` does.

### Sidebar

From `src/components/primitive/sidebar.tsx`:

| Dimension | Value |
|---|---|
| Expanded width | `16rem` (`SIDEBAR_WIDTH`; the layout passes `calc(var(--spacing) * 64)`, the same thing) |
| Collapsed (icon) width | `3rem` (`SIDEBAR_WIDTH_ICON`) |
| Mobile sheet width | `18rem` (`SIDEBAR_WIDTH_MOBILE`) |
| Nav item height | `h-8` default · `h-7` `size="sm"` · `h-12` `size="lg"` |
| Group label height | `h-8`, `text-xs font-medium`, `text-sidebar-foreground/70` |
| Item radius / padding | `rounded-md`, `p-2`, `gap-2`, icons `size-4` |
| Active item | `data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground` |
| Collapse transition | `duration-200 ease-linear` on `[left,right,width]` |

`AppSidebar` is `SidebarHeader` (logo → `/os`) + `SidebarContent`
(`NavMain` over `sidebarItems` from `src/config/sidebar-config.ts`) +
`SidebarFooter` (`NavUser`). Nav is config-driven — add a route by editing
`sidebar-config.ts`, not by hand-writing menu items.

The header logo swaps with the collapse state: `client-logo-hor.png` when
expanded, `client-logo-square.png` at 32 × 32 on the `3rem` icon rail. Both
images stay in the markup and are toggled with `hidden` — `display: none`, so
the inactive one leaves the accessibility tree too — via
`group-data-[collapsible=icon]:`. `SidebarMenuButton` forces `p-2` when
collapsed, which would leave only 16px for the mark, so the logo row overrides
it with `group-data-[collapsible=icon]:p-0!`. Note the `client-logo-*` prefix:
that is the deploying client's brand, overridden per client app, not Alaiy's.

### Page header

Always `PageHeader` from `src/components/layout/page-header.tsx`:

```tsx
<PageHeader title="Sales Orders" subtitle="Track order volume, value, and delivery commitments." action={…} />
```

It renders the page's `h1` at `text-2xl font-semibold tracking-tight`,
`text-muted-foreground text-sm` for the subtitle, and right-aligns `action` on
`sm:` and up (stacking below on mobile). It is presentational and has no
`"use client"`, so a Server Component can render it directly.

**Use it exactly once per page, and use it for every page.** It is the `h1`, so
a second one would leave the page with two top-level headings, and a page
without one leaves a screen-reader user navigating by heading with no title.
Section headings *inside* a page are `CardTitle` or a plain `h2` — never another
`PageHeader`. Every route under `/os` goes through it; the only hand-rolled
headings left are the `not-found` screens and the Ask Alaiy hero, which are not
page headers.

On a detail page, `title` is the document name and `subtitle` is the doctype
(`title={order.name} subtitle="Sales Order"`), with the action slot holding the
docstatus actions plus a back link.

### KPI row

Sits directly under the page header, **above** the card that holds the table.

Where it is rendered depends on where its data comes from. Sales Orders and
Purchase Orders fetch summaries client-side (the figures track the list's live
filters), so the KPI row is the first child of the client list component.
Products fetches its overview on the server, so `page.tsx` renders
`ProductKpiCards` itself and passes the data down. Either is fine; put the row
wherever its data is fetched.

- Grid: `grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4`. Four cards is
  the established count.
- Each card: `Card` › `CardHeader` (`CardDescription` = label, `CardAction` =
  a `size-4` lucide icon) › `CardContent` with the value at
  `text-2xl leading-none tracking-tight` and a one-line comparison below at
  `text-sm`.
- Trend chip: `Badge variant="outline"` with `TrendingUp`/`TrendingDown`, green
  when the movement is good and `destructive` when it is not. **Direction is not
  goodness** — pass `lowerIsBetter` for metrics like Past-due Deliveries so more
  is coloured as bad.
- Loading: four `Skeleton className="h-[122px] w-full rounded-xl"`, matching the
  settled card height so the row does not jump.
- No comparison window (no date range picked) means show the figure alone and
  say *"Pick a date range to compare"* — never invent a baseline.
- Failure is a plain `text-muted-foreground text-sm` sentence, not an empty
  card.

`SalesOrderKpiCards` is the reference implementation.

## Component patterns

### List page

The shape used by Sales Orders, Purchase Orders, and Products. The `page.tsx`
stays a thin Server Component; a `_components/<entity>.tsx` client component
owns all the state.

```
page.tsx (server)
└── div.flex.flex-col.gap-4
    ├── PageHeader
    └── <Entity/> (client)
        └── div.flex.flex-col.gap-4
            ├── <Entity>KpiCards                       KPI row, outside the card
            └── Card.gap-0
                ├── CardHeader.border-b                filter bar
                │   ├── InputGroup h-7 w-full md:w-64  search + ⌘K Kbd
                │   └── CardAction                     right-aligned controls
                └── CardContent.px-0.gap-0
                    ├── div.border-b.px-4.py-2         status tabs
                    │   └── Tabs / TabsList / TabsTrigger
                    └── <Entity>Table
                        ├── div.overflow-x-auto › Table
                        ├── Separator
                        └── PaginationFooter
```

The filter bar and the tabs live **inside** the same `Card` as the table, split
across `CardHeader` and `CardContent`. `Card` gets `gap-0` and `CardContent`
gets `px-0` so the table can run edge to edge while the header keeps its
padding.

Control order in `CardAction`, left to right — keep it, so the same button is in
the same place on every list: selection actions (only when rows are selected) ·
`DateRangePicker` · entity filter · `ButtonGroup[FilterPopover, clear-X]` ·
`ColumnSettingsPopover` · Export · primary New action. Everything is
`size="sm"` and `variant="outline"` except the primary action, which is the
default variant.

Other rules the existing lists all follow:

- **Search is debounced 300ms** into a separate state; the input updates
  immediately.
- **Any filter change resets to page 1.** Page 4 of the old result set is rarely
  page 4 of the new one — that is what `resetPage()` is for.
- **One filter set feeds both the table and the KPI strip**, so the figures
  above the table always describe the rows inside it.
- Server-driven table: `manualPagination`, `manualFiltering`, `manualSorting`,
  and an explicit `pageCount`.
- **Column preferences are persisted per user** via
  `useListPreference("<entity>:columns:v<n>")`. Bump the `:v<n>` suffix when
  changing `DEFAULT_COLUMN_ORDER`, or saved orders will hide the new column
  forever.
- Constants — `STATUS_TABS`, `EMPTY_STATE_BY_TAB`, `DEFAULT_COLUMN_ORDER`,
  `COMPULSORY_COLUMNS`, `MIN_VISIBLE_COLUMNS`, `BASE_FIELDS` — belong in
  `src/constants/<entity>.ts`, never inline.
- **Status tabs are a fixed list**, not derived from the data. A tab that
  disappears because nothing is currently in that state makes the filter row
  jump, and "no orders to bill" is a useful answer in itself.

### Data table

From `SalesOrderTable` / `sales-order-columns.tsx`:

| Concern | Rule |
|---|---|
| Cell padding | `px-4` (via `**:data-[slot='table-cell']:px-4`), `py-3`, `align-middle` |
| Alignment | Left by default. Numeric fieldtypes (`Currency`, `Int`, `Float`, `Percent`) are `text-right` on **both** the header and the cell, driven by `meta.align` on the column definition |
| Header | `py-3 font-medium select-none`, `[&_tr]:border-t` |
| Row | `border-border/60 hover:bg-muted/40`, `cursor-pointer` only when clickable |
| Column widths | Only `select` is fixed (36px). Data columns stay unset so the browser fills the width, unless the user has dragged a resize handle. |
| Resize handle | `absolute right-0 w-1.5 cursor-col-resize`, `bg-primary` while resizing, `hover:bg-border` otherwise |
| First column | `select` checkbox, then a non-hideable `ID` column rendering a real `<Link>` (`font-medium hover:underline`) so rows open in a new tab and by keyboard |
| Row click | Navigates, but bails out when the click landed on `a, button, input, [role='checkbox']` — those controls handle themselves |
| Empty / loading | A single full-width `TableCell` with `colSpan`, `h-24 text-center text-muted-foreground` |
| Missing value | `<span className="text-muted-foreground">—</span>` (em dash), from `GenericCell` |

Render unknown doctype fields through `GenericCell`, keyed on Frappe
`fieldtype`, so a new fieldtype is taught to the app once.

### Detail page

`src/app/(main)/os/sales/orders/[id]/page.tsx` is the model. Server Component,
`notFound()` on a missing document, `Promise.all` for the document and company
info.

```
div.flex.flex-col.gap-4
├── PageHeader                       title=name, subtitle=doctype, action=[actions, back link]
├── Alert variant="destructive"      only when cancelled
├── Alert                            only when amended_from — links to the replaced doc
├── grid.gap-4.xl:grid-cols-12
│   ├── xl:col-span-8  OrderSummary
│   └── xl:col-span-4  OrderTotals
├── OrderLines                       full width
├── grid.gap-4.xl:grid-cols-2        linked documents, side by side
└── PaymentSchedule
```

A 12-column grid at `xl:` and above, collapsing to one column below; secondary
detail (totals) takes 4 of 12 beside the primary summary's 8. Actions live in
the page header's action slot, not in a sticky footer. State that changes what
the document *means* — cancelled, amended — is an `Alert` directly under the
header, not a pill buried in the body.

#### Media-led detail page

The Item page (`src/app/(main)/os/products/[id]/`) is the second shape, for a
document whose photograph is part of the answer. Same header and same
Server-Component rules; a different body:

```
div.flex.flex-col.gap-6
├── PageHeader                       title=item_name, subtitle="Item · <code>", action=[status, back]
├── grid.gap-6                       lg:[240px_1fr]  ·  xl:[300px_1fr_300px]
│   ├── col 1, rows 1-2, sticky      ItemGallery          (drops to row 1 of a single column below lg)
│   ├── col 2, row 1                 ItemOverview + ItemVariantPanel
│   ├── col 3, rows 1-2, sticky      ItemCommerceBox      (under the middle column at lg)
│   └── col 2, row 2                 ItemSectionNav + ItemSpecs
├── StockLevels                      full width, outside the grid
└── ItemPrices                       full width, outside the grid
```

What is different from the Sales Order shape, and why:

- **Sections, not Cards.** `PageSection` (an `h2`, an optional right-aligned
  count, and the content) instead of `Card`/`CardTitle`. The page reads as one
  document with a media column beside it, and a frame per band fought both the
  sticky columns and the tables that run edge to edge inside them. Tables get
  `overflow-hidden rounded-xl border` in place of the card they used to sit in.
- **Two sticky columns.** Both outer columns `row-span` the middle column's two
  rows and stick, so the price and the stock state stay on screen while the
  description, variants and specifications scroll past. Stickiness stops where
  the grid does, which is why the wide stock and pricing tables are outside it.
- **Offsets come from `DETAIL_STICKY_TOP` and `DETAIL_SCROLL_MARGIN`** in
  `constants/products.ts`, both measured off `--dashboard-header-height`. The
  shell header sticks at `top-0` under the default `navbar_style`, so anything
  else that sticks — or any heading a jump link lands on — has to clear it.
- **`position: sticky` needs the shell to not be a scroll container.** The
  content wrapper in `(main)/os/layout.tsx` is `overflow-x-clip`, not
  `overflow-x-hidden`: `hidden` on one axis computes the other to `auto`, which
  made that div a scrollport that never scrolls and silently disabled every
  sticky descendant on every page. Don't change it back.
- **Every grid child carries `min-w-0`.** A grid item's automatic minimum size is
  its min-content width, so one wide descendant grows its track past the grid,
  and the shell clips the surplus rather than scrolling it.
- **A jump nav, not tabs.** `ItemSectionNav` scroll-spies the sections in
  `ITEM_DETAIL_SECTIONS` and highlights whichever is crossing the middle of the
  viewport. It only scrolls — every section stays in the DOM, so find-in-page and
  a `#item-pricing` deep link both still work.

#### Editing in place

The Item page writes as well as reads, through two client components that every
edit surface on it goes through — `EditableField` for a value, `EditableToggle`
for a Check. The rules they encode are worth following on the next page that
becomes editable:

- **The affordance is visible, not hover-only.** Each editable value carries a
  muted pencil that strengthens on hover, and the value itself is the click
  target. An affordance that only appears on hover cannot be seen before it is
  found and does not exist at all on a touch screen — the first cut of this page
  hid the pencil at `opacity-0` and read as entirely read-only.
- **One field, one write, no form.** A value is read-only until it is clicked,
  and Save writes that field alone. There is no page-level dirty state
  and no Save bar, because a catalogue edit is a correction to one field rather
  than a form submission. A Check has no edit mode at all: the flip *is* the
  write, since a boolean has one other state and an intermediate step around it
  would be ceremony.
- **A refused write keeps the editor open with the draft intact.** The stored
  value was never replaced, so there is nothing to roll back — but closing the
  editor would throw away what was typed and leave the operator unsure which
  value is now live. Frappe's own message is the toast, via `frappeErrorMessage`
  in `lib/frappe/error-message.ts`; never a generic "Request failed".
- **`router.refresh()` after a successful save.** The page is a Server
  Component and half of what it shows is derived — the status badge from
  `disabled`, the stock pill from `is_stock_item`, the gallery from the variants
  — so re-rendering the route is the only thing that keeps those honest. Between
  the save and the refresh the control shows what was written, so nothing
  flashes back to the old value.
- **Permission decides the affordance, the server decides the write.**
  `can_write.item` from `get_item_detail` is what makes the page render as plain
  values for a reader, and `update_item` re-checks the permission regardless: a
  client flag is a hint. The same split applies to *which* fields — the
  `WRITABLE_FIELDS` allowlist lives in `alaiy_os/api/item.py`, so the request
  decides values and never which fields.
- **A field the page will not write says why.** `item_code` is the docname,
  `valuation_rate` is derived from stock movements — both keep their row with
  the reason on hover, rather than being dropped so the table looks tidy.
- **Warn before a lossy save.** `Item.description` is stored as HTML and edited
  here as text; where the stored value contains markup the editor says so before
  it is replaced.

### Tree page

Item Groups (`src/app/(main)/os/item-groups/`) is the only tree today:

```
div.flex.flex-col.gap-3
├── div.flex.items-center.justify-end.gap-2    expand-all · collapse-all · New
└── ItemGroupTreeView                          @headless-tree, indent: 20
```

Editing happens in dialogs (`create` / `edit` / `rename` / `delete`) driven by a
single discriminated-union `DialogState`, not a side panel. Mutations call
`invalidateChildrenIds()` on the affected parent rather than refetching the
whole tree.

One trap: `useTree()` returns a single mutable instance whose identity never
changes, which React Compiler will happily cache forever, leaving the tree
permanently empty. Any component that touches a tree instance needs the
`"use no memo"` directive, and the same goes for a TanStack table instance.

**"Touches" includes receiving one as a prop, not just calling the hook.** A
presentational child that reads `table.getState()` is exactly as affected as
the component that created the table: the guard React Compiler emits is an
identity check on the instance, which never fails, so the read happens once on
first render and the value is pinned forever. The pagination footer was frozen
to first-page state this way (#206). Every component in this app that creates
*or* receives one of these instances carries the directive.

### Empty state

Two different things, don't mix them up:

- **An empty table** is a message row inside the table: `h-24 text-center
  text-muted-foreground`, worded for the active tab from `EMPTY_STATE_BY_TAB`
  ("No orders to bill." beats "No results." when the user is standing on the To
  Bill tab).
- **An empty page or panel** uses the `Empty` primitive
  (`src/components/primitive/empty.tsx`): `Empty` › `EmptyHeader` › `EmptyMedia
  variant="icon"` (a `size-8 rounded-lg bg-muted` chip holding a `size-4` icon)
  › `EmptyTitle` (`font-heading text-sm font-medium`) › `EmptyDescription`
  (`text-sm/relaxed text-muted-foreground`), optionally `EmptyContent` for a
  CTA. It centres itself and carries `border-dashed`.

A load *failure* is neither: it is a plain `text-muted-foreground text-sm`
sentence that says what to do — *"Could not load … Make sure you're signed in
and try again."*

### Overdue highlight

Amber on **the offending cell only**, never the whole row — a row is not
entirely wrong just because one date has passed:

```tsx
<span className={cn("inline-flex rounded px-1.5 py-0.5",
  pastDue && "bg-amber-500/15 font-medium text-amber-700 dark:text-amber-300")}
  title={pastDue ? "Delivery is past due" : undefined}>
```

"Past due" is decided by `isDeliveryPastDue()` in `src/lib/sales-orders.ts`,
which ignores orders in `SETTLED_STATUSES` — an order past its date is only
worth flagging while it can still be delivered. That list **mirrors
`SETTLED_STATUSES` in `alaiy_os/api/sales_order_stats.py`**: the cell highlight
and the Past-due Deliveries KPI have to agree on what overdue means. Change one,
change the other.

### Buttons

`src/components/primitive/button.tsx`. Sizes are `h-6` (`xs`), `h-7` (`sm`), `h-8`
(default), `h-9` (`lg`), plus `icon`/`icon-xs`/`icon-sm`/`icon-lg` squares.
List-page toolbars use `sm`. Variants: `default` (primary fill), `outline`
(toolbar default), `secondary`, `ghost`, `destructive` (a tinted
`bg-destructive/10 text-destructive`, **not** a solid red fill), `link`. A solid
fill is available if a confirm-delete action ever needs one —
`bg-destructive text-destructive-foreground`, contrast-checked per preset — but
nothing uses it today and the tint is the house style.
Bare lucide icons auto-size to `size-4`; no explicit class needed.

### Cards

`Card` is `rounded-xl bg-card text-sm ring-1 ring-foreground/10` with padding
driven by `--card-spacing` (`--spacing(4)`, or `--spacing(3)` at
`size="sm"`). Note it is a **ring**, not a border. Use `CardHeader` /
`CardTitle` / `CardDescription` / `CardAction` / `CardContent` / `CardFooter`
rather than hand-rolled padding; `CardAction` already handles right-aligned
header controls, and `CardFooter` already has `border-t bg-muted/50`.

## Spacing & grid

Tailwind's 0.25rem `--spacing` base. Observed usage, most to least common:

| Step | Typical use |
|---|---|
| `gap-2` (0.5rem) | Toolbar buttons, icon + label, sidebar nav internals |
| `gap-4` (1rem) | **Vertical rhythm between page sections**, KPI grid gutters |
| `gap-1` / `gap-1.5` | Label + value, tight inline groups |
| `gap-3` | Tree page sections, mid-density rows |
| `gap-6` | Occasional wide separation |
| `gap-0` | Explicit collapse — `Card gap-0` on a list card so the table meets the header |

Defaults to reach for:

- Page root: `flex flex-col gap-4`.
- Content padding: `p-4 md:p-6` (given by the shell — don't re-add it).
- Card padding: `--card-spacing`, i.e. `p-4`, via the `Card` sub-components.
- Table cells: `px-4 py-3`.
- Responsive grids: `grid-cols-1` → `md:grid-cols-2` → `xl:grid-cols-4` for KPI
  rows; `xl:grid-cols-12` for detail layouts. Breakpoints in use are `sm`, `md`,
  `lg`, `xl`, and `@container` queries on card headers.

## Radius, ring, shadow

`--radius` is `0.625rem` by default (`0.5rem` under `alaiy-os`), and
`@theme inline` derives the scale from it:

| Utility | Value |
|---|---|
| `rounded-sm` | `--radius - 4px` |
| `rounded-md` | `--radius - 2px` |
| `rounded-lg` | `--radius` |
| `rounded-xl` | `--radius + 4px` |
| `rounded-2xl` | `--radius + 8px` |
| `rounded-3xl` | `--radius + 12px` |
| `rounded-4xl` | `--radius + 16px` |

Conventions: cards `rounded-xl` · buttons `rounded-lg` · sidebar items and
inputs `rounded-md` · pills `rounded-4xl`.

Focus is a ring, never an outline removal: `focus-visible:ring-3
focus-visible:ring-ring/50` with `focus-visible:border-ring` on buttons,
`ring-[3px]` on badges, and a global `outline-ring/50` default. Invalid form
state is `aria-invalid:border-destructive` plus `aria-invalid:ring-destructive/20`
(`/40` in dark) — drive it from `aria-invalid`, not a custom class.

Shadows only exist under a non-default preset (see
[Theme presets](#theme-presets)). Cards use `ring-1 ring-foreground/10`
instead, which is why the default theme looks flat by design.

## Motion

Sparse and short. The whole app uses four durations:

| Duration | Where |
|---|---|
| `duration-100` | Hover and colour transitions on dense controls — the most common |
| `duration-200 ease-linear` | Sidebar collapse/expand (`[left,right,width]`), group-label fade |
| `duration-300` | The navigation menu only — its chevron rotate and viewport transition |
| — | `transition-colors` and `transition-all` with no explicit duration take Tailwind's 150ms default |

Rules:

- Animate `colors`, `opacity`, `transform`, or an explicit property list. Avoid
  animating layout-affecting properties beyond the sidebar's width, which is
  already handled.
- Buttons nudge on press: `active:not-aria-[haspopup]:translate-y-px` — popover
  triggers are excluded so a menu doesn't jump as it opens.
- `.disable-transitions *` sets `transition: none !important` and is applied
  while a theme preference is being switched, so the app doesn't cross-fade
  every colour at once. Don't fight it.
- `tw-animate-css` is available for enter/exit animations; `html` carries
  `overscroll-behavior: none`.
- Respect the print path: `[data-print-root]` is hidden on screen and is the
  only thing shown in `@media print`, at a fixed 8.5in × 11in Letter page.
