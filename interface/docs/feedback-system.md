# Build spec · Alaiy OS

## Feedback System — v1

A friend's one-line spec, expanded into something buildable:

> dump this somewhere for manual review — either write to a doctype —
> feedbacks, capture user and feedback, with agent trail.

v1 is deliberately small: capture, don't analyse. No dashboard, no triage
workflow — a doctype list view is the review UI, and a human reads it.
Sentiment is a plain up/down thumb, not a rating scale.

| | |
|---|---|
| **Surfaces** | Desk floating widget (`interface/desk-widget/src/askAlaiy/AskAlaiyPanel.tsx`) · the standalone Desk page at `/app/ask-alaiy` (`alaiy_os/alaiy_os/page/ask_alaiy/ask_alaiy.js`) · the docked launcher panel (`interface/src/components/ask-alaiy/ask-alaiy-panel.tsx`) · the dedicated page (`interface/src/app/(main)/os/ask-alaiy/_components/ask-alaiy-chat.tsx`) |
| **Backend** | New: `alaiy_os.api.feedback`, new doctype `OS Chat Feedback` |
| **Audience** | Anyone who can use Ask Alaiy (same audience as the chat itself) |
| **New deps** | none |

---

## Context

### Why this has to exist

Right now a bad Ask Alaiy answer just sits there. Nobody building the
prompts or the tools ever sees it unless the user happens to mention it in
Slack. There is no capture mechanism at all — not a bad one, none.

v1 fixes that with the smallest thing that could possibly help: a thumbs
up/down on every assistant reply, landing in one doctype next to *exactly
what the agent did* to produce that reply — the tool calls, in order, not
just the final text. A thumbs-down also asks for a reason before it'll
submit, since "the stock number was wrong" without the trail that
produced it is a bug report with no repro, but reading it next to "called
`get_stock_cover`, got zero, wrote 'out of stock' anyway" is a bug report
you can act on. Thumbs-up needs no explanation to be useful — a bare
positive signal is already a complete data point.

**Every settled assistant reply, no exceptions.** A plain-text answer that
called no tools at all gets the same thumbs as a five-step one — this is
not a "when there's something interesting to show" control. `agent_trail`
on a no-tool reply is just `{ text, tools: [] }`; an empty tool list is
data, not a reason to hide the control. Don't gate this on
`turn.toolCalls.length > 0` anywhere.

### Why it has to work in four places, not one

Ask Alaiy already exists as four separately-coded surfaces (see
`ask-alaiy-widget.md` at the bench root for why): a Vite bundle for the
floating Desk widget, a hand-rolled vanilla JS/jQuery Frappe Page for the
standalone `/app/ask-alaiy` route, and two React trees inside the
`interface/` Next.js app — the docked launcher panel and the dedicated
`/os/ask-alaiy` page. The two `interface/` surfaces already share
`ToolTrail`, `AttachmentChip`, and `useTypedText` via re-export from
`ask-alaiy-panel.tsx`; the Frappe Page shares nothing with any of the
other three — it is neither React nor built by the same bundler.

The feedback control follows the same rule anyway: one shared component
for the two `interface/` surfaces, one independently-written (but
behaviourally identical) equivalent for the Vite Desk widget, and a third
independently-written equivalent inline in the Frappe Page's own
controller — three different implementations of the same state machine
and API contract, because none of the three can import a component from
either of the others across those build/framework boundaries.

Both Desk-side surfaces (the floating widget and the standalone page)
report `screen: "Desk"` — v1 does not distinguish which Desk surface a
piece of feedback came from, only that it came from Desk rather than
`interface/`. Splitting that out is easy to add later if it turns out to
matter (see Boundaries).

---

## Scope

### Files

| File | Action | What it is |
|---|---|---|
| `alaiy_os/alaiy_os/doctype/os_chat_feedback/*` | New | The doctype itself. |
| `alaiy_os/api/feedback.py` | New | One whitelisted method: `submit_feedback`. |
| `interface/src/components/ask-alaiy/feedback-control.tsx` | New | The shared control: thumbs up/down → (down only) inline textarea → submit. Exported, same pattern as `ToolTrail`. |
| `interface/src/lib/frappe/feedback.ts` | New | Data layer — same `call<T>` / error-extraction shape as `chat.ts`. |
| `interface/src/components/ask-alaiy/ask-alaiy-panel.tsx` | Edit | Render `<FeedbackControl>` under each settled assistant turn. |
| `interface/src/app/(main)/os/ask-alaiy/_components/ask-alaiy-chat.tsx` | Edit | Same, in `ChatBubble`. |
| `interface/desk-widget/src/askAlaiy/FeedbackControl.tsx` | New | Desk widget equivalent — same API call, hand-rolled markup against `styles.css` (can't share the shadcn-based component from `interface/`). |
| `interface/desk-widget/src/askAlaiy/AskAlaiyPanel.tsx` | Edit | Render the Desk widget's `FeedbackControl` under each settled assistant turn. |
| `alaiy_os/alaiy_os/page/ask_alaiy/ask_alaiy.js` | Edit | Third, independent equivalent (`_feedback_control`) inline in the Frappe Page controller, called from `_draw()` next to `_copy_button()`. Also adds a `this._reply_tools` accumulator (a `Map<call.id, {tool, input, failed}>`) since this page draws one `OS Chat Message` row at a time rather than grouping a multi-step reply into one turn client-side the way the other three surfaces do — see that field's own comment for why it has to be reset in two places (`_send()` for a message typed live, the `role === "user"` branch of `_draw()` for one replayed from history). |

---

## Contract

### `OS Chat Feedback` doctype

| Field | Type | Reqd | Notes |
|---|---|---|---|
| `user` | Link → User | Yes | Set server-side from `frappe.session.user`. Never trust a client-supplied value here — the whole point is knowing who actually said it. |
| `sentiment` | Select | Yes | Options: `Up\nDown`. The thumb the user clicked. |
| `feedback` | Small Text | Conditional | Required (and trimmed server-side) when `sentiment` is `Down` — that's the entire point of asking for a reason on a bad reply. Optional on `Up`, where a bare thumb is already a complete signal. Not `reqd` at the doctype level since the requirement is conditional on another field; enforced in `submit_feedback` instead. |
| `screen` | Select | Yes | Options: `Desk\nInterface Panel\nInterface Page` (literal newline-separated Select options, no other doctype defines these — don't reuse `OS Chat Message`'s own fields for this). |
| `session` | Link → OS Chat Session | Yes | |
| `message` | Link → OS Chat Message | Yes | The specific message the control was attached to (see "Which message" below). |
| `agent_trail` | JSON | Yes | Snapshot of what produced the reply — see below. Not a live query against `message` at review time; a snapshot, taken at submission. |

Autoname: leave it as Frappe's default hash-based name (`hash`). Nobody
looks up an `OS Chat Feedback` row by name — the list view is the only access
path — so there's no case for a naming series here.

Standard `owner` / `creation` already give a redundant second "who and
when" for free; keep the explicit `user` field anyway; it's what actually
shows as a column in the list view without configuring one.

**Why both `message` (a Link) and `agent_trail` (a snapshot) — isn't one
redundant?** No: they answer different questions and fail differently on
purpose.

- `agent_trail` is the record of record. It survives even if the
  underlying `OS Chat Message` rows are ever pruned, edited, or the
  session is deleted — a feedback row must stay meaningful on its own,
  since "what did the agent actually do" is the entire reason this exists.
- `message` is a convenience: click through from the list view straight
  into the original conversation for full context (surrounding turns,
  what the user actually asked). It's allowed to go stale (a broken Link
  if the message is ever removed) without taking `agent_trail` down with
  it — that's precisely why it's a separate field and not the only way to
  reach the trail.

If `OS Chat Message`/`OS Chat Session` rows are never actually pruned in
this app today, this distinction costs nothing to keep and pays for itself
the day someone does add a retention policy.

### `alaiy_os.api.feedback.submit_feedback`

```python
def submit_feedback(session: str, message: str, sentiment: str, screen: str, agent_trail: str, feedback: str = None) -> dict:
    """Returns {"name": <OS Chat Feedback name>}."""
```

- 403 if the caller can't read `session` — gated via `OS Chat Session`'s
  own `check_permission("read")`, the same `if_owner` check every other
  session-scoped chat call already relies on (see
  `alaiy_os.api.chat`'s module docstring). This is what stops one user
  tagging feedback onto someone else's conversation.
- 417 if `message` doesn't belong to `session` (checked via
  `frappe.db.exists`, not just that `message` exists at all).
- 417 if `sentiment` isn't `Up` or `Down`.
- 417 if `sentiment` is `Down` and `feedback.strip()` is empty. `Up` has no
  such requirement — `feedback` may be omitted entirely.
- `screen` validated against the doctype's own Select options; anything
  else is a 417, not a silent default.
- `agent_trail` stored as-is (already JSON-stringified by the caller — see
  below for why); only checked for being valid JSON, no reshaping
  server-side.

### Which message, and what "agent trail" actually is

A multi-step reply is not one growing `OS Chat Message` row — it's
several separate messages, one per tool call, each individually settling
(see `groupAssistantTurns` in `interface/src/hooks/use-ask-alaiy.ts`, and
the Desk bundle's own `useAskAlaiy.ts`, which groups the same way). The
UI already reconstructs the full trail client-side for display — that's
exactly the `ToolTrail`/`AnswerBody` data already sitting in the grouped
turn when the feedback control renders next to it.

**v1 decision: the client sends that already-assembled trail, not a
message id for the server to re-derive from.** Concretely, `message` is
the *last* underlying `OS Chat Message` in the group (the one carrying
the final text — the stable anchor for "which reply is this"), and
`agent_trail` is a JSON-stringified array the frontend builds from the
grouped turn:

```ts
type TrailEntry = { tool: string; input: unknown; failed: boolean };
// agent_trail = JSON.stringify({ text: turn.text, tools: turn.toolCalls.map(...) })
```

This is a deliberate v1 shortcut, not an oversight — see Boundaries.

---

## Layout

### The control, at rest and open

Two small thumb icons per assistant turn, quiet until used:

```
  ✦  The top 10 products by sales value are listed below.

     ┌───────────────────────────────┐
     │ Item Name          Total Sales│
     │ …                             │
     └───────────────────────────────┘

     👍  👎
```

Thumbs-up submits immediately — no intermediate state, since a bare
positive signal is already complete. Thumbs-down expands a textarea in
place — no dialog, no navigating away from the conversation:

```
     👍  👎
     ┌────────────────────────────────────────────┐
     │ What was wrong with this reply?             │
     │                                              │
     └────────────────────────────────────────────┘
                                    Cancel   Send
```

After a successful submit (either thumb), collapse back to a quiet
confirmation in the same spot, and don't show the control again for that
turn — one piece of feedback per reply is enough for v1, and re-showing
it invites duplicate noise:

```
     ✓ Feedback sent — thanks.
```

---

## States

The implementation tracks this as two pieces of state — `status` and
`sentiment` — and branches primarily on `sentiment`: once `Down` is
chosen the textarea stays up through open/sending/error, while an `Up`
submission's sending and error states render inline on the thumbs
themselves rather than ever showing a textarea.

| State | Render |
|---|---|
| idle | Both thumb icons, `sentiment` unset. |
| Up, sending | Thumbs-up icon replaced by a spinner, both thumbs disabled — no double-submit from a second click while the request is in flight. |
| Up, error | Both thumbs again (retry either), plus an inline error next to them. |
| Down, open | Textarea + Cancel/Send. Send disabled while the *trimmed* textarea is empty — whitespace-only doesn't count, check client-side too rather than relying on the server's 417 to catch it. |
| Down, sending | Send button shows a spinner, textarea and both action buttons disabled. |
| Down, error | Textarea and error message shown together — draft preserved, Send retries, Cancel discards and returns to idle. |
| sent | Replaces the whole control with "Feedback sent — thanks," regardless of which thumb was used. Permanent for that turn (component-local state, not persisted — a refresh can show the control again, which is fine for v1). |

### Transitions, explicitly

`idle → Up/sending` (click thumbs-up — submits immediately, no
intermediate state) · `idle → Down/open` (click thumbs-down) ·
`Down/open → idle` (Cancel, draft discarded) · `Down/open → Down/sending`
(Send, trimmed text non-empty) · `*/sending → sent` (success, either
sentiment) · `*/sending → */error` (failure, same sentiment) ·
`Up/error → Up/sending` (click thumbs-up again, retry) ·
`Up/error → Down/open` (click thumbs-down instead) ·
`Down/error → Down/sending` (Send again, same draft) ·
**`Down/error → idle` (Cancel, draft and sentiment discarded —
easy to miss since Cancel is usually drawn next to Send in the `open`
layout, but it must still work from `error`, not just from `open`)**.
`sent` is terminal; nothing transitions out of it for that turn.

---

## Flow

1. User clicks a thumb under a *settled* assistant turn (no control on a
   turn that's still `partial` — there's nothing finished to react to
   yet, and the trail wouldn't be complete).
2. Thumbs-up calls `submitFeedback({ session, message, sentiment: "Up",
   screen, agent_trail })` immediately, with no `feedback` — straight to
   the sending state.
3. Thumbs-down opens a textarea, focused. Cancel closes it, discarding
   the draft and returning to idle. Send calls `submitFeedback({ ...,
   sentiment: "Down", feedback: trimmed })`; disabled until the trimmed
   textarea is non-empty.
   `screen` is hardcoded per surface either way (each of the four files
   knows which one it is; it is never asked of the user — see "Why it has
   to work in four places, not one" for why both Desk surfaces share the
   value `"Desk"`).
4. On success: collapse to the confirmation, done.
5. On failure: show the error inline. For thumbs-down, keep the draft so
   they can retry without retyping; for thumbs-up, show both thumbs again
   so they can retry or switch to thumbs-down instead.

---

## Copy

| Where | String |
|---|---|
| thumb labels (a11y) | Good reply · Bad reply |
| placeholder (thumbs-down only) | What was wrong with this reply? |
| actions | Cancel · Send |
| confirmation | Feedback sent — thanks. |
| error fallback | Couldn't send that — try again. |
| doctype-level 417 (empty reason on Down) | Tell us what was wrong before sending a thumbs-down. |

---

## Boundaries

### Out of scope for v1

- **Any review UI beyond the doctype list view.** No dashboard, no
  grouping by session, no "resolved" workflow. `bench` gives you a list
  view the moment the doctype exists; that is the whole review surface.
- **Rating scale beyond a binary thumb.** Up/Down only — no 5-star, no
  numeric score. A thumb is enough to make the free-text reason
  actionable; anything finer-grained is analysis, which is explicitly out
  of scope for v1.
- **Re-deriving the agent trail server-side from `message` at review
  time.** Doing that properly means walking the session's messages in
  order and re-running the same grouping logic `groupAssistantTurns`
  already does client-side, in Python, a second time. For a v1 whose
  entire job is "dump it somewhere a human reads later," a client-sent
  snapshot is good enough and an order of magnitude less work. It does
  mean the trail is only as trustworthy as the client that sent it —
  fine for internal manual review, not fine if this doctype is ever read
  by anything automated. Flag this explicitly if that changes.
- **Editing or deleting feedback from the UI.** Whoever reviews it does
  that from the Desk list view like any other doctype record.
- **Rate limiting / spam protection.** Same trust boundary as sending a
  chat message at all — if that's not guarded today, this doesn't need
  to be either.
- **The doctype's permissions beyond "the logged-in user can create their
  own."** No custom role, no field-level permission — System Manager
  (or whoever can already see `OS Chat Session`) reads the list; that's
  the existing role model, not a new one for this feature.
- **Distinguishing the two Desk surfaces in `screen`.** The floating
  widget and the standalone `/app/ask-alaiy` page both report `"Desk"`.
  Splitting that into two Select options is a small, additive change if
  it turns out reviewers need to tell them apart — not worth doing
  speculatively now.

---

## Done

### Ready to review when

- [ ] `OS Chat Feedback` exists with the fields above; a System Manager can
      open its list view and see submitted rows with `user`, `sentiment`,
      `screen`, `feedback`, and `agent_trail` populated.
- [ ] `submit_feedback` rejects a caller who can't read `session` (403),
      a `message` that doesn't belong to `session` (417), an unknown
      `sentiment` or `screen` (417), and a `Down` submission with empty
      feedback (417).
- [ ] Thumbs-up submits with an empty `feedback` and no intermediate
      textarea — verify a `Down`-shaped 417 never fires for an `Up`
      submission.
- [ ] The thumbs render under a settled assistant turn — and only a
      settled one — in all four surfaces: the Desk floating widget, the
      standalone `/app/ask-alaiy` Desk page, the docked panel, and the
      dedicated `/os/ask-alaiy` page.
- [ ] The control also renders on a reply that used **zero** tools (plain
      text answer, no ToolTrail) — not just on tool-using ones. This is
      the one most likely to get silently gated by accident.
- [ ] Submitting from each surface produces one `OS Chat Feedback` row with
      the correct `screen` value for that surface (`"Desk"` for both Desk
      surfaces, see Boundaries).
- [ ] `agent_trail` on a multi-step reply contains every tool call from
      the grouped turn, not just the last one; on a no-tool reply it's
      `{ text, tools: [] }`, not an empty/missing field. On the standalone
      Desk page specifically, this means confirming `_reply_tools`
      actually accumulates across the separate `OS Chat Message` rows a
      tool-calling reply is stored as, rather than only reflecting the
      final row's own (typically empty) `tool_calls`.
- [ ] Whitespace-only text doesn't enable Send on the thumbs-down textarea
      (client-side), and a request that somehow sends one anyway gets a
      417, not a blank `feedback`.
- [ ] Cancel works from the `Down`/`error` state, not just from
      `Down`/`open` — clears the draft and sentiment, collapses back to
      the idle thumbs.
- [ ] An error on thumbs-up shows both thumbs again (not a stuck
      textarea) so the user can retry either one.
- [ ] After a successful submit, the control doesn't reappear for that
      turn without a page reload.
- [ ] `biome check` is clean on the `interface/` changes; no new
      dependency was added anywhere.
