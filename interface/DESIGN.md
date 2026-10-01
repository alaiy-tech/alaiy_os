---
name: Alaiy
description: A commerce operating system for D2C brands — inventory, orders, suppliers, channels, and AI agents in one place.
colors:
  primary-50: "#f4f8fc"
  primary-100: "#eef3f9"
  primary-200: "#c9dcf2"
  primary-300: "#bfd8f7"
  primary-400: "#1d4f86"
  primary-500: "#33475b"
  primary-600: "#06182b"
  primary-700: "#0b2744"
  primary-800: "#04111e"
  primary-900: "#020a12"
  active: "#eef3f9"
  ink: "#06182b"
  ink-soft: "#061a2e"
  ink-muted: "#3e5165"
  muted: "#5a6b7d"
  muted-soft: "#8a98a6"
  line: "#e2e6e1"
  line-strong: "#d5dbd4"
  ground: "#f6f7f4"
  sunken: "#f1f4ef"
  sunken-deep: "#eef1ec"
  card: "#ffffff"
  ok: "#22c55e"
  ok-soft: "#e9f7ee"
  ok-ink: "#15803d"
  warn: "#fb923c"
  warn-soft: "#fff1e0"
  warn-ink: "#b45309"
  alert: "#dc2626"
  alert-soft: "#fdeded"
  alert-ink: "#991b1b"
typography:
  title:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
    role: "H1 — a data tab's own page title, once per page"
  accent:
    fontFamily: "var(--font-instrument-serif), Georgia, serif"
    fontStyle: italic
    fontWeight: 400
    letterSpacing: "-0.01em"
    role: "the second half of a split headline — never a whole heading, never body copy"
  section:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.2
    role: "H2 — a section heading inside a page, e.g. 'Latest orders'"
  heading:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    lineHeight: 1.2
    role: "H3-H6 — card and panel titles"
  eyebrow:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.14em"
    role: "a section's name above its heading — 'YOUR MORNING'"
  stat:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "32px"
    fontWeight: 600
    fontFeatureSettings: "tabular-nums"
    role: "a KPI tile's own figure"
  lead:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
    role: "one prominent line of supporting copy"
  body:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    role: "the dense-UI default — most of what the product actually reads at"
  table:
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    fontFeatureSettings: "tabular-nums"
    role: "table figures and identifiers specifically"
  caption:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    role: "a secondary caption — a footnote, a synced-at timestamp, a tool-trace chip"
  chip:
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    role: "a small pressable chip or pill's own label"
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "22px"
  xl: "26px"
  pill: "9999px"
spacing:
  ask-panel: "360px"
  ask-panel-xl: "400px"
  rail: "240px"
components:
  press:
    backgroundColor: "{colors.primary-600}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "44px"
    fontFamily: "var(--font-geist-sans)"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "0.8px solid {colors.line}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
---

# Design System: Alaiy

## Overview

**The landing page's own system, brought into the product.** Sourced from
`design.md` — the written-from-the-code reference for the alaiy marketing
site — rather than from a mockup. That document records two palettes living
side by side on the landing: a Tailwind `navy-*` theme consumed only by its
own navbar, and the raw hex every real section actually draws with. This
system takes the second one, exactly as its §6 "Recurring hex palette (the
*real* design system)" lists it.

This is the fourth visual system this file has recorded. Unlike the previous
three, it is not authored for the product in isolation: the brief is that a
seller should not meet a second visual world fifteen minutes after the one
that sold them. Where the landing has an answer, the landing wins — including
where that reverses a rule the previous system stated outright.

It is a surface reskin. The shell's proportions are untouched: the rail is
still 240px, Ask Alaiy is still docked and open by default, the sidebar is
still flat.

**Key Characteristics:**
- One hue (navy, anchored on `#06182B`) does ink, panel and accent duty, as
  on the landing — the accent role is `#1D4F86`, a lighter step of the same
  hue, not a second colour.
- Geist Mono is the data face: every figure, counter, eyebrow and table
  identifier. This reverses the previous system's "No Separate Data Face".
- Instrument Serif appears **italic only**, and only as the accent half of a
  split headline. It is never a whole heading and never body copy.
- The ground is warm (`#F6F7F4`), not the cool `#F7F9FC` it replaces.
- Cards get a hairline border and no shadow; shadows are for genuinely
  floating surfaces only. Carried over unchanged — the landing is flat too.
- Radius is rounder: 6/10/14/22/26px, anchored on the landing's own measured
  card (22px) and panel (26px) values.

## Colors

### Primary
- **Ink** (`#06182B`, primary-600): the rail, headings, primary text, and the
  active plate on any light ground. Darker and bluer than the `#0D2B45` it
  replaces.
- **Ink soft** (`#061A2E`): a dark panel — the landing's answer card and its
  closing CTA. A token rather than a reuse of ink, because it sits a touch
  lighter and bluer beside it.
- **Accent** (`#1D4F86`, primary-400): interactive text, focus rings, the
  serif accent on a light ground.
- **Tints** (`#9CC3F5`, `#C9DCF2`, `#BFD8F7`, `#EEF3F9`): wires, plates, chip
  fills, and the serif accent where it sits on ink.

### Neutral
- **Ground** (`#F6F7F4`): the page.
- **Card** (`#FFFFFF`): every card, table and field.
- **Line** (`#E2E6E1`) / **Line strong** (`#D5DBD4`): the hairline that
  separates a card from the ground, and the heavier "inactive" neutral the
  landing uses for an upcoming progress dot.
- **Sunken** (`#F1F4EF`) / **Sunken deep** (`#EEF1EC`): a section that is
  neither white nor the default ground — a nested panel, a zebra row.
- **Ink muted** (`#3E5165`) / **Muted** (`#5A6B7D`) / **Muted soft**
  (`#8A98A6`): supporting copy, secondary text, and the quietest legible step.

### Status
Green `#22C55E`/`#E9F7EE`/`#15803D` and amber `#FB923C`/`#FFF1E0`/`#B45309`,
both read straight off the landing.

**Red is the one family with no landing source.** §6 has a green and an amber
and nothing else. The alert family is carried over from the previous system,
because a suspended-account banner needs a colour the landing never had to
have. If the landing ever grows a red, this should follow it.

### Named Rules
**The One Hue Rule.** Navy carries ink, panel and accent at different
lightness steps — unchanged in spirit from the previous system, now anchored
on the landing's own ink.

**The Current Thing Is The Most Contrasted Thing.** The landing's "you are
here" is always maximum contrast against its own ground: an active progress
dot is solid `#06182B` among `#D5DBD4` neighbours, an active module pill
lights up navy, an active tab takes a solid underline. On a light ground that
is an ink plate with white text (MobileNav, the Orders segmented control). The
rail is itself ink, so it inverts the same rule — the active row is the palest
blue tint with ink text.

The mint `#D5F3F3` that used to be the one "you are here" marker has no
counterpart anywhere in the landing palette and is **retired**, not kept as an
orphan.

**Cards Get a Line, Not a Shadow.** Carried over unchanged. A resting card's
only separation from the ground is its hairline border.

## Typography

**Body Font:** Geist — page titles, H2-H6, body copy, labels, nav, buttons.
**Data Font:** Geist Mono — every figure, counter, eyebrow, tag and table
identifier.
**Accent Font:** Instrument Serif, 400, italic only.

### Named Rules
**The Mono Is The Data Face.** The previous system had an explicit "No
Separate Data Face" rule: KPI figures and table rows were the body face with
`tabular-nums`. The landing does the opposite — its `.mono` class is fixed as
"eyebrows, counters, numeric figures, tab labels". That rule wins here.
`--font-data` points at Geist Mono and all ~59 `font-data` call sites moved
with it. Mono is wider per character than the face it replaces; this was
checked against the real Orders and Latest-orders tables and changes no column
layout, but it is the thing to watch when adding a dense column.

**The Serif Is An Accent, Not A Heading.** `.serif` is italic/400 by
definition and goes on a `<span>` *inside* a heading, around the part of the
line that turns — "Your store data, *answerable.*", "Where the business
*stands*". A one-word page title ("Orders", "Listings") has no accent half and
stays sans; the landing never splits a headline that has nothing to split.
Setting a whole `h1` in the serif is a regression.

There is **one** whole-line exception, and it is deliberate: Alaiy's own
opening sentence on the Ask screen (`text-quote`, 22px). That is the product
speaking rather than labelling, and it is the only place the serif carries a
full line.

### Hierarchy
- **Title** (600, 36px, Geist, -0.035em): a data tab's own page title.
- **Section** (600, 24px, Geist): a section heading inside a page. Up from
  20px — that value was sized against a serif at 600, which carried more
  weight per pixel than Geist does at the same size.
- **Heading** (600, Geist): a card or panel's own title, H3-H6.
- **Eyebrow** (600, 11px, Geist Mono, +0.14em): a section's name above its
  heading.
- **Stat** (600, 32px, Geist Mono, tabular): a KPI tile's own figure.
- **Lead** (400, 19px/1.55): one prominent supporting line — the landing's own
  sub size, up from 15px.
- **Body** (400, 14px): the dense-UI default. Unchanged.
- **Table** (400, 13.5px, Geist Mono, tabular): unchanged in size — the
  landing has no dense-table step to read off, and changing a 13.5px row is a
  density decision, not a theme one.
- **Caption** (400, 12px) / **Chip** (500, 12.5px): unchanged.

## Layout

Unchanged. A left rail (`--spacing-rail`, 240px) and a docked Ask Alaiy panel
(`--spacing-ask-panel`, 360px, widening to 400px at `80rem`), both flexbox so
the main column and the Orders detail panel resize off the same CSS variable.
The landing's pin-to-pin Stage architecture (its 1440×900 canvas,
`useSmoothScroll`, the "settle before handoff" hold) is **marketing-page
machinery and is deliberately not brought across** — a product screen is
scrolled to read, not scrubbed through.

## Elevation & Depth

Flat by default, as before. A card's only separation from the ground is a
0.8px hairline border. The shadow tokens are retinted to the new ink
(`rgb(6 24 43 / …)`) and still exist solely for a surface that genuinely
floats: a toast, the Orders detail drawer, a dropdown, a tooltip.

### Shadow Vocabulary
- **sm** `0 1px 4px rgb(6 24 43 / 0.06)` — a button's hover lift.
- **md** `0 2px 12px rgb(6 24 43 / 0.08)` — a stronger hover; the composer's lift.
- **lg** `0 4px 24px rgb(6 24 43 / 0.12)` — a floating surface. Aliased `--shadow-float`.
- **xl** `0 8px 40px rgb(6 24 43 / 0.16)` — a modal.
- **nav** `0 2px 16px rgb(6 24 43 / 0.1)` — a sticky bar's bottom edge.

## Shapes

Rounder than the system it replaces: 6 / 10 / 14 / 22 / 26px plus a full pill.
`lg` (22px) is the card step and `xl` (26px) the panel step — both read off the
landing's own measured surfaces (its answer and query cards at 22px, its chat
panel at 26px). The small end is not documented on the landing, so 6/10/14 are
interpolated down from 22 rather than read.

## Motion

The landing's three transition classes are carried across under their own
names, so a component can say what kind of movement it is making:

- **`.t-move`** `all .9s cubic-bezier(.2,.8,.2,1)` — something that travels.
- **`.t-fade`** opacity/transform/filter — something that appears.
- **`.t-quick`** `all .35s ease` — a button, a cell. `.press` now moves at this
  pace rather than the 100ms it used before: a button that snaps while the card
  beside it glides reads as two systems.

`.animate-rise` takes the landing's `fade-up` exactly (opacity 0→1 over
translateY 16px→0, 0.6s ease-out). All of it, plus the three classes above, is
stripped under `prefers-reduced-motion: reduce`.

## Components

### Buttons (the `.press` system)
Filled ink, no border, flat at rest; a soft shadow and a light lift on hover
only. 10px radius (was 12px).
- **Light** (on the page ground): filled ink, white text.
- **Dark** (on the ink rail): the palest blue tint with ink text — the same
  inversion the active nav row makes, because an ink fill on an ink rail
  vanishes.
- **Alert**: filled alert-red, white text.
- **Quiet** / **Link**: unchanged — muted text with no fill, and an inline
  accent-coloured text action.

### Cards
22px radius, white, a 0.8px hairline border, no shadow at rest. 20px padding.

### Inputs
White, hairline border, 14px radius, 44px height. Border brightens to the
accent on focus. Ask Alaiy's composer keeps the app's one exception: the focus
state lives on the bordered box (`focus-within`), not the field itself.

### The dotted ground (`.dot-grid` / `.dot-grid-dark`)
The landing's recurring texture — a 22px grid of `rgb(6 24 43 / .08)` dots on
the ground, or white dots at 6% on an ink panel. In the product it belongs to
the surfaces a seller meets before the dense UI starts: sign-in, onboarding,
an empty state. It is not a background for a data screen.

### Navigation
Unchanged flat sidebar — ink panel, white wordmark. The active item is a solid
`#EEF3F9` plate with ink text; MobileNav, on its light ground, takes the rule
the right way up with an ink plate and white text.

## Do's and Don'ts

**Do**
- Reach for navy at a lighter step (300/400) when something needs the "accent"
  role, rather than a second hue.
- Split a headline and set its second half in `.serif` when the line has a
  natural turn — and leave it alone when it does not.
- Set every figure, counter and eyebrow in Geist Mono.
- Give a card a hairline border and stop there.
- Use one of the five named radius steps before writing an arbitrary value.

**Don't**
- Set a whole `h1`/`h2` in the serif, or use the serif upright, or use it for
  body copy. The one whole-line exception is Alaiy's opening sentence on the
  Ask screen.
- Reintroduce the mint `#D5F3F3`, or reach for a second accent hue.
- Put the dot-grid behind a data screen.
- Add a shadow to a resting card.
- Bring the landing's Stage/scroll machinery into a product screen.
