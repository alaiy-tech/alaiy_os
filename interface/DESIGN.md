---
name: Alaiy
description: A commerce operating system for D2C brands — inventory, orders, suppliers, channels, and AI agents in one place.
colors:
  navy-50: "#eff6fb"
  navy-100: "#d6eaf8"
  navy-200: "#c0e0f4"
  navy-300: "#aed6f1"
  navy-400: "#1e5f8b"
  navy-500: "#1a4a6b"
  navy-600: "#0d2b45"
  navy-700: "#0b2540"
  navy-800: "#0a2238"
  navy-900: "#071826"
  mint-active: "#d5f3f3"
  ink: "#0d2b45"
  muted: "#64748b"
  muted-soft: "#94a3b8"
  line: "#e2e8f0"
  ground: "#f7f9fc"
  card: "#ffffff"
  ok: "#16a34a"
  ok-soft: "#eaf7ef"
  ok-ink: "#15803d"
  warn: "#d97706"
  warn-soft: "#fdf4e3"
  warn-ink: "#92400e"
  alert: "#dc2626"
  alert-soft: "#fdeded"
  alert-ink: "#991b1b"
typography:
  title:
    fontFamily: "var(--font-playfair), Georgia, 'Times New Roman', serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.08
    role: "H1 — a data tab's own page title, once per page"
  section:
    fontFamily: "var(--font-playfair), Georgia, 'Times New Roman', serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    role: "H2 — a section heading inside a page, e.g. 'Latest orders'"
  heading:
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    lineHeight: 1.2
    role: "H3-H6 — card and panel titles"
  eyebrow:
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.14em"
    role: "a section's name above its heading — 'YOUR MORNING'"
  stat:
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    fontFeatureSettings: "tabular-nums"
    role: "a KPI tile's own figure"
  lead:
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    role: "one prominent line of supporting copy"
  body:
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    role: "the dense-UI default — most of what the product actually reads at"
  table:
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    fontFeatureSettings: "tabular-nums"
    role: "table rows specifically"
  caption:
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    role: "a secondary caption — a footnote, a synced-at timestamp, a tool-trace chip"
  chip:
    fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    role: "a small pressable chip or pill's own label — a suggestion pill, an alert's dismiss control"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "9999px"
spacing:
  ask-panel: "360px"
  ask-panel-xl: "400px"
components:
  press:
    backgroundColor: "{colors.navy-600}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "44px"
    fontFamily: "var(--font-poppins)"
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

**"The Morning Briefing."** Sourced from an authored Claude Design mockup — every token below is read off that mockup's own rendered output (computed `border-radius`, `box-shadow`, `color`, exact type sizes), not invented or guessed. This is the third visual system this file has recorded this year; unlike the second (a drift the product corrected back out of), this one replaces the incumbent by deliberate brief, and the old one is retired as evidence of what the product was rather than kept as a parallel truth.

One navy hue carries ink, panels and the interactive/accent role at different lightness steps, rather than pairing navy with a separate accent colour the way the prior two systems each did. White cards float on an off-white ground, told apart by a hairline border — confirmed against the mockup's own real elements, a card computes to a 16px radius, a 0.8px border, and **no box-shadow at rest**. One mint tone (`#D5F3F3`) marks "you are here" and nothing else — the sidebar's active nav item, exclusively.

**Key Characteristics:**
- One hue (navy) does ink, panel and accent duty; a separate mint marks only the current location in the sidebar.
- Cards get a hairline border and no shadow; the shadow tokens exist for genuinely floating surfaces (a toast, a drawer, the nav bar's edge) only.
- Four real radius steps (4/8/12/16px) plus a full pill, not one flat value.
- Playfair Display narrows to Title (36px) and Section (20px) only — every other heading and all body/table/KPI text is Poppins, including tabular figures (no separate "data" face).

## Colors

Navy at several lightness steps, plus one status set and one single-purpose mint.

### Primary
- **Ink** (`#0D2B45`, navy-600): the sidebar, headings, primary text. Unchanged in spirit from every prior system — always the panel/ink colour.
- **Link** (`#1E5F8B`, navy-400): interactive text, focus rings — this system's "accent" role, at a lighter step of the same hue rather than a second colour.
- **Accent tint** (`#AED6F1`, navy-300): a plate, a segmented control's active fill.

### Neutral
- **Ground** (`#F7F9FC`): the page.
- **Card** (`#FFFFFF`): every card, table and field — visually distinct from the ground in this system (unlike the immediately-prior one, where the two had converged).
- **Line** (`#E2E8F0`): the hairline border that is the only thing separating a card from the ground now that shadows are reserved for floating surfaces.
- **Muted** (`#64748B`) / **Muted soft** (`#94A3B8`): secondary and quietest legible text.

### The one mint
`#D5F3F3` marks the sidebar's active nav item and nothing else — not a general second accent. Reaching for it anywhere else reopens a second accent this system deliberately doesn't have.

### Status
Healthy `#16A34A`/`#EAF7EF`, caution `#D97706`/`#FDF4E3`, action-required `#DC2626`/`#FDEDED` — each with a darker `-ink` step for text on its own soft ground.

### Named Rules
**The One Hue Rule.** Navy carries ink, panel and accent at different lightness steps. Reaching for a second hue for "the accent" is how the prior two systems each ended up spending two colours where this one spends one.

**Cards Get a Line, Not a Shadow.** A resting card's only separation from the ground is its hairline border. A shadow under a resting card is a regression, confirmed against the mockup's own computed styles twice (a KPI tile, a table-section card — both `box-shadow: none`).

## Typography

**Display Font:** Playfair Display, narrowed to two roles only: Title (H1, 36px/600) and Section (H2, 20px/600).
**Body Font:** Poppins — H3-H6, body copy, labels, nav, buttons, table rows and KPI figures alike.
**Label Font:** JetBrains Mono — the Eyebrow only.

**Character:** One geometric sans carries almost everything; the serif is reserved for the two headline moments a page gets, not spent on every heading the way the immediately-prior system spent it on H1-H6 uniformly.

### Hierarchy
- **Title** (600, 36px, Playfair): a data tab's own page title — confirmed against the mockup's own tokens frame ("Title · 36/600 → Where the business stands").
- **Section** (600, 20px, Playfair): a section heading inside a page — confirmed ("Section · 20/600 → Latest orders").
- **Heading** (600, Poppins): a card or panel's own title, H3-H6.
- **Eyebrow** (600, 11px, JetBrains Mono, tracking +0.14em): a section's name above its heading.
- **Stat** (600, 30px, Poppins, tabular): a KPI tile's own figure — confirmed ("KPI · 30/600 tnum").
- **Lead** (400, 15px): one prominent supporting line.
- **Body** (400, 14px): the dense-UI default — confirmed ("Body · 14/400"), a real bump from the 13px the prior two systems used.
- **Table** (400, 13.5px, tabular): table rows specifically — confirmed ("Table · 13.5/400").
- **Caption** (400, 12px): a secondary caption — a footnote, a synced-at timestamp, a tool-trace chip's own label.
- **Chip** (500, 12.5px): a small pressable chip or pill's own label — a suggestion pill, an alert's dismiss control.

### Named Rules
**No Separate Data Face.** KPI figures and table rows are Poppins with `font-variant-numeric: tabular-nums`, not a distinct geometric/mono typeface the way the prior system spent Geist. Confirmed directly in the mockup's own tokens frame: "Poppins for everything else, tabular figures on every number."

## Layout

Unchanged from the prior system: a left rail (`--spacing-rail`, 240px) and a docked Ask Alaiy panel (`--spacing-ask-panel`, 360px, widening to 400px at the `80rem` breakpoint), both flexbox rather than grid so the main column and the Orders detail panel resize off the same CSS variable with no coordination code. This is a surface reskin; it doesn't touch the shell's proportions or the sidebar's flat structure.

## Elevation & Depth

Flat by default. A card's only separation from the ground is a 0.8px hairline border — confirmed twice against real rendered elements (`box-shadow: none`). The shadow tokens exist solely for a surface that genuinely floats over the page: a toast, the Orders detail drawer, a dropdown, a tooltip.

### Shadow Vocabulary
- **sm** (`0 1px 4px rgb(13 43 69 / 0.06)`): a button's hover lift.
- **md** (`0 2px 12px rgb(13 43 69 / 0.08)`): a button's stronger hover state; the hero composer's resting lift.
- **lg** (`0 4px 24px rgb(13 43 69 / 0.12)`): a genuinely floating surface — aliased as `--shadow-float` for the handful of call sites (the import toast, the Orders drawer, a chart tooltip) that already used that name.
- **xl** (`0 8px 40px rgb(13 43 69 / 0.16)`): a modal, if one is ever needed.
- **nav** (`0 2px 16px rgb(13 43 69 / 0.1)`): the sticky nav bar's own bottom edge.

### Named Rules
**Floating Only.** A shadow means "this is not part of the page flow." Anything that sits in the page's own flow — a card, a KPI tile, a table — gets a border, never a shadow.

## Shapes

Four real steps: 4px (a small badge), 8px (a button, an input), 12px (a select, a session-rail row), 16px (a card, a table). `rounded-full` for genuinely round things — a dot, a spinner, an avatar-style icon plate — plus the sidebar's active-nav pill and a segmented control, both confirmed effectively full-round against the mockup's own rendered output.

## Components

### Buttons (the `.press` system)
Filled navy, no border. Flat at rest — a soft shadow only appears on hover, alongside a light upward lift; both settle back to flat on click. No hard offset shadow anywhere in this system.
- **Light** (on the page ground): filled navy, white text.
- **Dark** (on the navy sidebar): filled with the palest accent tint, navy text — a navy-on-navy fill would vanish, so the sidebar's own primary action takes the tint instead.
- **Alert**: filled solid alert-red, white text.
- **Quiet**: not a press at all — muted text, no fill, for a de-emphasized action ("Cancel").
- **Link**: an inline text action ("Export CSV", "View all →") — plain accent-coloured text with no fill, border or padding of its own, confirmed against the mockup's own rendered output.

### Cards
16px radius, white background, a 0.8px hairline border, no shadow at rest. 20px padding standard.

### Inputs
White background, hairline border, 12px radius, 44px height. Border brightens to the accent on focus. Ask Alaiy's composer keeps the app's one exception: the focus state lives on the bordered box (`focus-within`), not the field itself.

### Navigation
Unchanged flat sidebar (not the mockup's own grouped-sections layout, by explicit choice) — navy panel, white wordmark. The one nav-specific colour in the whole system: the active item is a solid mint (`#D5F3F3`) plate with navy text, not a tint of the accent.

## Do's and Don'ts

**Do**
- Reach for navy at a lighter step (300/400) when something needs the "accent" role, rather than a second hue.
- Give a card a hairline border and stop there; reach for a shadow only when the surface genuinely floats over the page.
- Use one of the four named radius steps (4/8/12/16px) before writing an arbitrary value.
- Set KPI and table figures in Poppins with `font-variant-numeric: tabular-nums` — there is no separate data face to reach for.

**Don't**
- Use the mint active-pill colour anywhere except the sidebar's current nav item.
- Add a hard offset shadow anywhere — that belonged to an earlier system this file no longer describes.
- Spend Playfair on anything past Title/Section — H3-H6 and body copy are Poppins.
- Assume the sidebar groups into sections or that Ask Alaiy defaults to collapsed — this pass explicitly kept the existing flat nav and docked-by-default panel; only the visual language changed.
