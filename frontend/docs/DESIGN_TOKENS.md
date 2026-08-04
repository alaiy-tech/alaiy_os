# Design tokens

Source of truth: `mydesign/Alaiy OS Dashboard.dc.html` (the approved Claude
Design prototype, one level up from `frontend/`). Every color below was
lifted directly from that file, not eyeballed from a screenshot.

Light mode only - there is no dark variant in the approved design.

## Brand

| Token | Hex | Tailwind class | Use |
|---|---|---|---|
| navy | `#003254` | `bg-navy` / `text-navy` | primary actions, active nav, sidebar active item |
| navy hover | `#013F66` | `hover:bg-navy-hover` | primary button hover |
| blue | `#91D1F2` | `bg-blue` | focus rings, chart secondary line, highlights |
| paper | `#F7F4EF` | `bg-paper` | sidebar background (paper theme) |
| ink | `#1A1A2E` | `text-ink` | body text |

## Surfaces & lines

| Token | Hex | Use |
|---|---|---|
| `surface-faint` | `#FBF9F6` | table header row, row hover |
| `surface-subtle` | `#F9F7F4` | kbd chip background |
| `surface-dashed` | `#FDFCFA` | dashed wireframe panel background |
| `surface-hoverBlue` | `#F1F8FD` | suggestion chip hover |
| `line-faint` | `#F1EDE6` | hairline dividers between rows |
| `line-subtle` | `#EDE8E0` | card borders |
| `line` (default) | `#E7E2D9` | input/button borders |
| `line-strong` | `#E0DAD0` | secondary button borders |
| `line-hover` | `#CFC8BC` | border on hover |
| `line-dashed` | `#DCD5C9` | dashed wireframe border |

## Text tiers

| Token | Hex | Use |
|---|---|---|
| `ash` | `#8E8E9E` | uppercase eyebrow labels, muted meta |
| `ash-2` | `#9C9CAC` | icons, secondary meta |
| `ash-3` | `#A8A296` | wireframe placeholder text |
| `slate` | `#6B6B7B` | body secondary text |
| `slate-2` | `#3E4759` | table secondary cell text |
| `slate-3` | `#5C6472` | grey status-pill text |

## Status pills

Every status badge in the app is one of these five pairs (`fg` on `bg`),
pill-shaped (`rounded-full`), `text-[11.5px] font-medium px-[9px] py-[3px]`:

| Status examples | fg | bg |
|---|---|---|
| success (Active, Completed, Paid) | `#15803D` | `#EAF6EE` |
| warning (Low stock, To Bill, To Deliver, On Hold) | `#96601A` | `#FDF6E9` |
| info (To Deliver and Bill) | `#1F5E86` | `#EDF6FC` |
| danger (Out of stock, Overdue, Cancelled) | `#B4232A` | `#FDF2F2` |
| neutral (Draft, Closed, Disabled) | `#5C6472` | `#F3F3F5` |

See `src/lib/status.ts` for the `statusPillClass()` helper that maps a status
string to the right pair - mirrors the design's `statusPill()` function.

## Type

Geist (400/500/600/700) throughout - headings included. The design does not
use a serif display face; page titles are Geist at larger size/weight
(e.g. `text-[26px] font-semibold tracking-[-.025em]`), not a different font.
