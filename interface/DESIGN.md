# Alaiy — the design system, as built

Four values carry the whole product:

| | | |
|---|---|---|
| **Paper** | `#F7F4EF` | the ground the entire product sits on |
| **Navy** | `#003254` | every panel, and every word of text |
| **Highlight blue** | `#91D1F2` | the one accent |
| **Border** | `#DFD9CD` | the line between a card and the ground |

Everything else in [globals.css](src/app/globals.css) is derived from those, and
nothing is invented that is not needed to say something the four cannot.

The system as drawn is a marketing system: a page read once, top to bottom.
This is a product a seller opens every morning and scans a thousand table rows
in. Where the two disagree, this file says which won and why — see
[Where this departs from the system](#where-this-departs-from-the-system). The
short version: every rule about **ground, shape, shadow, type and the button**
is applied literally. The additions are all about *state* — saying "that sync
failed" — which a two-colour system has no vocabulary for.

---

## The ground is paper, not white

Paper is not one option in a rotation. It is *the* surface, and navy is used
with intent — the rail, the sign-in masthead, the seller's own words in a
transcript — rather than alternated with it.

White survives in exactly one role: **a card sitting on paper**, which is how
the system's own colour swatches are drawn. So in a component:

- `bg-canvas` — the page. Paper. Also `bg-paper`, the same value under the name
  of the thing rather than the role.
- `bg-white` — "this is a card." A card, a field, a table, an answer.
- `bg-surface` (`#EFE9DD`) — a deeper paper, for a ground that has to sit
  *inside* paper: a filter bar, a table's header band, a collapsed helper. It is
  warm on purpose; a blue tint here fights the ground.
- `bg-primary-600` — a navy panel. Used with intent, never in rotation.

A hover wash on paper is `bg-primary-600/5` or `bg-primary-600/[0.04]` — navy
diluted, so it stays in the same family as the ground. It is never a blue tint;
blue is the accent, not a neutral.

## One shape

The system draws a single 5px corner and squares everything else, so **every
radius step resolves to one of two values**:

```
--radius-xs: 3px    a chip, a status pill, a tiny icon button
--radius-sm: 5px    everything else
--radius-md .. 3xl  all 5px
```

`rounded-md` through `rounded-3xl` collapsing to 5px is deliberate: a
`rounded-2xl` left behind in a component cannot quietly reintroduce a second
shape language.

`rounded-full` is reserved for things that are genuinely round — a status dot, a
spinner, the ring on a bullet. There are seven of them in the codebase and every
one is a circle.

## One shadow

The system has exactly one shadow: an **offset, unblurred block of colour**. It
is what makes a button read as a key to press, and it is the only thing in the
product that casts one.

```
--shadow-press       4px 4px 0 navy     a button at rest
--shadow-press-lift  6px 6px 0 blue     a button under the cursor
--shadow-press-dark  4px 4px 0 white/25 a button on a navy panel
--shadow-float      10px 10px 0 navy/14 a surface genuinely floating
```

A card gets a 1px line and **nothing else**. The 1px line against paper is what
separates the two surfaces, and it is enough precisely because paper is not
white — the old blurred `shadow-lift` existed to fake that separation on a white
ground and has no job here.

`--shadow-float` is the one exception, for the import toast: a surface lying
across whatever the page is showing has to say it is above it. Navy at low alpha
rather than solid, because it falls over content.

## The arcade press

There is **no filled "primary" button**. Every call to action is the same
outlined shape: it lifts towards the reader on hover and its shadow turns accent
blue, then on click the shadow collapses to nothing as the button travels into
where the shadow was. The travel and the shadow add up to the same distance, or
the press reads as a slide.

The geometry lives once, in `@layer components` in globals.css, as `.press` plus
a ground. It is in a layer so a utility class at a call site still wins — a
button that needs `w-full` says so in Tailwind and does not have to fight the
component.

Use it through `Button`, `ButtonLink`, or `pressClass()` from
[components/ui](src/components/ui/index.tsx):

```tsx
<Button>Book a demo →</Button>                       // on paper
<Button ground="dark">Sign up / Login</Button>        // on a navy panel
<Button ground="alert" size="sm">Yes, disconnect</Button>
<Button ground="quiet">Cancel</Button>
<a href="…" className={pressClass()}>Continue with Google</a>
```

**Grounds** — the only choice is what colour the button is standing on:

| `ground` | |
|---|---|
| `light` (default) | navy on paper |
| `dark` | white on a navy panel |
| `alert` | the destructive confirm — see below |
| `quiet` | not a press at all — see below |

**Sizes** — `md` (h-11, form scale) and `sm` (h-9, a control inside a row).
`sm` is a real size in the system rather than an `h-9` appended to `md`, so
which height wins is a decision and not an accident of stylesheet order.

**Since nothing is filled, nothing is ranked.** Two buttons side by side are the
same shape, and which one a screen wants taken is said by where it is and what
it reads — not by how loud it is. This is why `Connect`/`Cancel` and
`Products`/`Orders` no longer have a primary and a secondary.

### `quiet`, and why it exists

`quiet` has no border, no shadow and no travel. It is for an action that must be
*available* without being *offered* — "Cancel" beside a confirm, "Clear" beside
a filter, "Details" on a toast.

Making these the full shape would give a way out the same weight as the thing
itself, and a screen where every control is a key to press has no emphasis left
anywhere.

### `alert`, and why it keeps the shape

The disconnect confirm is the only press in the product that is not
brand-coloured. It keeps the geometry exactly — it has to read as a key — and
takes the alert ink for its border and its block, so colour is the only thing
saying this one cannot be taken back. Its hover lift stays in its own hue rather
than turning blue, because blue there would read as "and now it is safe."

### Disabled

A disabled press sits flat where it was pressed: no shadow to promise a press
that will not happen, and no travel on hover.

## Type

Three faces, each with one job. Loaded in
[app/layout.tsx](src/app/layout.tsx).

| | | |
|---|---|---|
| **Playfair Display** | `font-display` | anything read once: headings, Alaiy's greeting |
| **Poppins** | `font-sans` | everything read at length: body, labels, nav, buttons |
| **Geist** | `font-data` | what a seller reads a thousand rows of |

`h1`–`h4` are the display face by default, via a `:where()` rule in globals.css,
so a component cannot forget. `text-wrap: balance` comes with it, because these
are short deliberate lines.

**Why a third face.** The system names two, and a third needs justifying. At
12–13px Poppins is wider and looser than Geist, and — the actual reason — it
sets numerals **proportionally**, so a column of money shifts under its own
alignment. `.font-data` also turns on `tabular-nums`. It is scoped to table
cells, SKUs, dates and figures, and it is the only reason a third family exists.

### The display scale

Five steps and a quote, named for the job rather than the size, because the size
is the thing most likely to be nudged and the job is not:

| utility | px / line-height | where |
|---|---|---|
| `text-display-xl` | 52 / 1.04 | the sign-in hero. Once, in the whole product |
| `text-display-lg` | 36 / 1.08 | Ask Alaiy's masthead, an onboarding step's `h1` |
| `text-display-md` | 26 / 1.12 | a data tab's own `h1` |
| `text-display-sm` | 18 / 1.20 | a card's or a connector row's `h2` |
| `text-display-xs` | 16 / 1.25 | a heading inside something small — the toast |
| `text-quote` | 20 / 1.40 | Alaiy speaking in its own voice |

`text-quote` is the odd one: display-face *body copy*, so unlike the headings it
gets a line height you can read a sentence at. It carries the greeting on the
first screen, and it is where the system's italic pull-quote would go.

**An `h1` with an arbitrary pixel value is how a scale becomes a list of numbers
nobody can review.** There are none left in the product.

Body copy stays in Tailwind's own steps and the 11–15px arbitrary sizes the data
surfaces were already tuned at; those are density decisions per table, not a
brand scale.

### The eyebrow

A section's name, above its heading — letterspaced small caps with the accent
squiggle. Use the component, not the class:

```tsx
<Eyebrow>Your data</Eyebrow>
```

The squiggle is `aria-hidden`; the label carries the meaning. Smaller labels
that are not section names (a column heading, a filter's name) are Poppins
semibold, 11px, `uppercase tracking-[0.12em]`, in `text-primary-500` — the
eyebrow's idiom at a size the eyebrow's letterspacing would not survive.

## The grain

Not decoration. It is what stops a flat fill from reading as plain beige, and it
is why paper looks like paper and navy looks like ink on it.

One fixed `body::before` layer over the whole viewport: an inline SVG
`feTurbulence`, 5% opacity, `mix-blend-mode: overlay`. Fixed and
`pointer-events: none`, so it neither repaints per scrolled frame nor
intercepts a click. Its `z-index: 9999` is above the app's own stacking on
purpose — a dialog that lost the grain would look like a different product.

## Colour, in practice

The navy and blue scales exist so a component does not have to reach for an
arbitrary alpha. The steps that matter:

- `primary-600` — the brand navy. Panels, text, borders, the press.
- `primary-500` (`#124E70`) — the readable mid-tone for a small label on a light
  ground. 7.4:1 on `surface`.
- `highlight-300` — the brand blue. **A plate you read navy text on** (8.0:1),
  never a text colour: on paper it is 1.5:1.
- `highlight-500/600/700` — the vivid steps. 500 for a dot or a progress bar;
  600 for a focus ring and an icon; 700 when a 12px figure has to be blue.
- `ink` / `muted` / `muted-soft` — text, in descending order of loudness.
  `muted-soft` is where text *stops*: anything quieter is not text, it is
  decoration, and should be `aria-hidden` rather than dimmer.

### Status

Three hues, each with one bright step and one `-ink`:

```
ok    #1F9D5F  ok-soft    #DCF2E0  ok-ink    #0A6136
warn  #E08A1E  warn-soft  #FBEECF  warn-ink  #7D4708
alert #D9401A  alert-soft #FBE3D9  alert-ink #A02310
```

The rule is strict: **the bright value drives fills, bars and dots; `-ink`
carries every word.** Bright-on-soft reads well at hero scale and measures
1.9–4.1:1, which is nowhere near what a seller reading a table at 12px needs.

## Contrast

Every text pair was measured. Navy on paper is 12.1:1 and blue on navy is
8.0:1, so the brand pairs were never the problem — the derived ones are:

| pair | ratio |
|---|---|
| navy on paper / white / surface | 12.1 / 13.3 / 11.0 |
| navy on the blue plate | 8.0 |
| white on navy | 13.3 |
| `muted` on paper / white | 6.6 / 7.3 |
| `muted-soft` on paper / white | 4.7 / 5.2 |
| `primary-500` on `surface` (a table heading) | 7.4 |
| `-ink` on its own soft ground | 6.2 – 6.6 |
| the eyebrow | 4.8 |
| the focus ring on paper (needs 3.0) | 4.0 |

Three things sit below 3:1, each deliberately:

- **Status dots.** Every one is paired with its own spelled-out label
  ("Connected", "Failed", "shopify"), so the dot is redundant reinforcement
  rather than the only way to read a state. They are `aria-hidden`.
- **The eyebrow's squiggle.** Decorative and `aria-hidden`. The system draws it
  in `#91D1F2`, which is 1.5:1 on paper — near invisible. It is
  `highlight-500` here, which is 3.0:1 and still unmistakably the accent.
- **A disabled press** (2.6:1). WCAG 1.4.3 exempts inactive controls, and the
  point of the state is that it is not available.

Two things that used to sit below the line and no longer do: the eyebrow (the
system's 55% navy measured 3.4:1, and is 68% here at 4.8:1), and the string of
`text-muted/50`–`/80` guesses that measured 2.3–4.1:1 and are now the one
measured `muted-soft`.

## Naming

**The product is "Alaiy". Never "Alaiy OS."** That is the ERPNext backend's
name, and a seller has no reason to ever meet it. It survives only in
[lib/backend](src/lib/backend/) doc comments, which are genuinely about that
backend.

The wordmark carries no "OS" beside it, and no lettering of its own: on paper it
keeps its navy-and-blue colouring, and on navy it uses the reversed lockup where
"al" and "y" invert to white and the "ai" at the centre stays accent blue —
never a flat white silhouette.

## Where this departs from the system

Four places, all of them because a product has to say things a page read once
does not.

**1. A status palette exists.** "Two colours, one accent" is right for a page
that is read once. This product has to say "that sync failed" and "those totals
are incomplete" in a table a seller scans daily, and blue cannot carry both a
link and a failure. The set is kept to three hues with one bright step and one
ink each, retuned warm so it sits on paper rather than on the white it was
originally mixed for.

**2. The eyebrow is navy at 68%, not 55%.** 55% measures 3.4:1 on paper — fine
for a 40px marketing eyebrow the eye skims past, not fine for a 12px one that is
the only thing naming a section.

**3. A third typeface, for numerals only.** See [Type](#type). Poppins sets
figures proportionally; a column of money that shifts under its own alignment is
a worse offence against the design than a third font file.

**4. `quiet` is not a press.** The system says every call to action is the one
shape. Taken literally, a "Cancel" gets the same weight as the confirm it sits
beside. `quiet` is the smallest possible carve-out: the low-emphasis escape
hatch, and nothing else.

## Where things live

| | |
|---|---|
| [app/globals.css](src/app/globals.css) | every token, `.press`, `.eyebrow`, the grain, the two animations |
| [app/layout.tsx](src/app/layout.tsx) | the three faces |
| [components/ui/index.tsx](src/components/ui/index.tsx) | `Button`, `ButtonLink`, `pressClass`, `Input`, `Select`, `Field`, `Card`, `Alert`, `Pill`, `Eyebrow`, `Logo`, `Spinner` |
| [components/data/](src/components/data/) | the table, toolbar, pagination and summary primitives |
| [components/ask/chat.tsx](src/components/ask/chat.tsx) | the conversation, and `Mark` — Alaiy's plate, shared with the panel header |

## Adding to this

- Reach for a token before an arbitrary value. If none fits, the honest move is
  usually to add one and say why in the comment, not to write `#3f7898` inline.
- A new heading is one of the six display steps.
- A new button is `Button` with a `ground`. If it needs a shape that is not the
  press, the question to answer first is why it is a button.
- A new colour with a job ("this means stale") needs a measured pair — a bright
  value and an ink — not one value used for both.
- Anything below 4.5:1 that a seller has to read is a bug, and anything below
  3:1 has to be redundant with a word.

## Motion

Two things only, both in the conversation, because that is the one screen where
movement carries meaning: a message arriving (`.animate-rise`, which fires on
insertion so a streaming answer does not judder) and the assistant being
mid-thought (`.animate-dot`, which scales rather than travels so the composer
below it does not shift).

Both stop entirely under `prefers-reduced-motion` rather than being softened,
because the transcript announces both anyway. The press stops travelling there
too but keeps its shadow change — that is the affordance, not the decoration.
