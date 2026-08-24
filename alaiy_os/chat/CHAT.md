# Ask Alaiy — in-app chat

A conversation with an LLM that can use the site's MCP tools, served from inside
Alaiy OS. No external MCP client, no desktop config, no OAuth round trip.

**Headless.** This module ships the engine and the HTTP surface only — there is
no UI in this app. Any client that can call a whitelisted Frappe method (the
desk, a Next.js frontend, a script, curl) is a first-class consumer.

```
any client  ──POST──▶ api/chat.send_message ┐
     │                                      │  (queued)
     └──poll──▶ api/chat.get_messages       ▼
                                 chat/runner.run_turn  (worker)
                                            │
               engine/llm.complete ◀────────┤────────▶ chat/tools.call_tool
               (ai_client hook)             │           (FAC tool registry)
                                            ▼
                               OS Chat Session / OS Chat Message
```

## The API

All under `/api/method/alaiy_os.api.chat.*`, authenticated like any other
whitelisted method (session cookie or `Authorization: token key:secret`).

| method | args | returns |
|---|---|---|
| `create_session` | `title?`, `model?` | `{session, title, model, status}` |
| `send_message` | `session`, `text?`, `attachments?`, `skill?`, `screen?`, `mentions?` | `{seq, status}` — queues the turn, returns immediately |
| `list_skills` | — | the `/` command catalogue |
| `list_mentions` | `q?`, `kind?` | the `@` picker's options, grouped by kind |
| `get_messages` | `session`, `after=0` | `{status, error, messages[]}` — the poll endpoint |
| `list_sessions` | `limit=50` | the caller's sessions, newest first |
| `delete_session` | `session` | `{deleted}` |
| `upload_attachment` | `session` + a multipart `file` | `{name, file_name, file_url, file_size, chars}` |
| `delete_attachment` | `attachment` | `{deleted}` — drops a staged upload |
| `list_tools` | — | what this user's assistant can do |

The flow is: `create_session` once, then per question `send_message` → poll
`get_messages(after=<highest seq seen>)` until `status` leaves `Running`.
Messages arrive as they are committed, so tool calls show up before the answer.

A message is
`{seq, role, text, attachments[], mentions[], skill, tool_calls[], tool_errors[]}`.
`tool_calls` is `{id, name, input}` per tool the assistant invoked; a tool's
*result* is not returned — it is raw JSON the model has already summarised in its
reply, and can be megabytes. Read `OS Chat Message.blocks` directly if you need
it. `attachments` is `{file_name, file_url, file_size, chars}` per file sent with
that message — enough to draw a chip, not the contents. `mentions` is
`{kind, value, label, sublabel, icon, hint, …}` per record named with `@`.

## Mentions (`@`)

Typing `@` in the composer opens a picker over the records a deployment lets
people name — brands, SKUs, marketplace channels, date windows. Choosing one
inserts a visible token *and* remembers the record behind it, which
`send_message(mentions=[{kind, value}])` carries to the turn.

What the model gets is a block ahead of the user's question:

```
<mentions>
The user named these records explicitly. Use these exact values as tool
arguments and filters — do not look them up by name again, and do not work out
any dates yourself; they are already resolved below.
- brand: "Royal Canin" — filter Brand = "ROYAL-CANIN"
- date: "last month" — 2026-07-01 to 2026-07-31 inclusive
</mentions>
```

The date line is most of the value. `_system_prompt` tells the model today's
date, which is an *invitation* to calendar arithmetic; a mention replaces the
invitation with the answer.

**Core ships no sources.** Which doctype holds a customer's brands is a fact
about the customer, so `list_mentions` returns whatever the
`chat_mention_sources` hook provides and nothing otherwise — a site with no
provider gets a picker that opens empty rather than a hardcoded guess. Each hook
entry is a dotted path to a no-argument callable returning sources of
`{kind, label, min_chars, search, resolve}`; see `chat/mentions.py` for the
contract and `alaiy_os_globali/chat_mentions.py` for a real one.

`min_chars` is what lets one endpoint serve both access patterns from one client
code path: a small fixed set declares 0 and populates on a bare `@`, while
anything with a LIKE behind it declares 2 and is not called at all until then.
The client draws the groups it is given and knows nothing about which is which.

**`resolve` is not `search`.** A picker's output is a claim, so every mention is
re-resolved server-side on send: the label and any dates are rebuilt from the
source, and only `kind` and `value` are read from the client. The gap between
searching and sending can be minutes, a permission change, or a hand-written
request. A mention that fails to resolve is **dropped silently** — unlike a
skill slug, which throws. A skill is the user's whole intent; a mention is one
hint among several, and killing the message over a stale one answers nothing.

Two ordering constraints, both load-bearing:

- The mention block goes **after** the attachment blocks, never before.
  `_elide_old_attachments` finds attachments by position — the first
  `len(attachments)` blocks — so anything inserted ahead makes it stub the wrong
  one.
- Mentions are **never elided** from history, unlike inlined attachments. A
  mention block is a handful of tokens naming a few records, and dropping it
  would make "and how did that brand do the month before?" unanswerable three
  turns later — exactly the follow-up mentions exist to make cheap.

In the composer a token is plain text, so the visible words and the record
behind them are two parallel records the user can pull apart by editing. The
client reconciles at submit rather than tracking offsets: a broken token stops
being a mention and goes on as prose. The model still reads the words either
way; only the resolved record is lost.

## Skills (`/`)

A skill is an `OS Agent Registry` row that ticked `chat_skill` and set a
`skill_slug` — so `list_skills` is a query, not a second registry, and an agent
app declares its skills in the same `agent_meta` manifest it already writes.

`send_message(skill="daily-digest")` runs that agent to completion **before**
the chat model's first call, and injects its output as a tool result:

```
user      "/daily-digest"                        skill_used = daily-digest
assistant [tool_use name="skill:daily-digest"]   ┐ written by skills.run_skill
user      [tool_result <the agent's JSON>]       ┘
assistant "GMV was ₹4.2L yesterday, up 8%…"      ← the normal _loop
```

Reusing the tool round-trip shape means nothing new has to render, `_trim`
keeps the pair together, and the model turns schema-validated JSON into prose —
which is why chat responses can stay markdown instead of needing a block format
for tiles and tables. Follow-ups work because the numbers are in the history.

Skills take **no arguments**: the agent runs on its own defaults and the user
refines conversationally in the next message.

The gate is not `OS Agent Run`'s permission (System Manager only — that would
put skills out of reach of the managers they are for). `run_turn` has already
pinned the worker to the session's owner, so the agent's tool handlers read as
that user with their row-level permissions applied. `chat_skill` is therefore a
**claim about the agent**: every tool enforces its own permissions and none of
them write. Tick it deliberately.

`engine.executor.run_now()` is what runs the agent in-process. Enqueuing a child
job and polling for it would deadlock a single-worker bench.

## Attachments

`upload_attachment` first, once per file, then pass the returned `name`s to
`send_message`. Either `text` or `attachments` may be omitted, but not both.

The model never receives a file — the gateway in front of the default model does
not reliably support native `image`/`document` blocks, and nothing downstream
(history replay, `_trim`, the tool loop) has any notion of a file. Instead
`_attachment_blocks` picks one of two modes per message, and records the choice
in each attachment's meta so a written block keeps meaning what it meant:

| mode | when | block |
|---|---|---|
| `tool` | the user can call FAC's `extract_file_content` | a pointer carrying `file_url`; the model reads the file itself |
| `inline` | no FAC, or the data_science plugin is off | the extracted text, quoted into the message |

**`tool` is the better path** and is what a bench with FAC gets. It costs a few
dozen tokens instead of up to 20k, puts no ceiling on how much of the file the
model can reach, and inherits that tool's table extraction and OCR. For
spreadsheets the pointer also nudges the model toward `parse_data`, and toward
`run_python_code` when that is available too — query the rows rather than read
them.

`inline` exists because FAC is deliberately optional (see `hooks.py`), so
`chat/attachments.py` is the floor rather than the ceiling: fewer formats than
`extract_file_content`, no OCR, no table structure, capped per file. Supported
there are PDF, `.xlsx`/`.xlsm`, CSV/TSV and plain text/code/JSON; legacy `.xls`
is rejected with a message telling the user to re-save, and **no images**.

Extraction runs at upload on *both* paths regardless, because it is what
validates that a file is readable at all — a scan with no text layer is rejected
while the user can still remove it, rather than silently reaching the model as an
empty document.

Extraction runs in the upload request, not the send path: `send_message` only
enqueues and must stay fast, and "there is no text in this PDF" has to reach the
user while they can still remove the file.

`OS Chat Attachment` is a staging row and nothing more — `start_turn` inlines its
`extracted_text` and deletes it. The uploaded `File` is private and attached to
the *session*, so it outlives the staging row (the sent message's chip still
links to it), inherits the session's `if_owner` permission, and is collected when
the session is deleted.

## Generated files

The other direction: a file the assistant *wrote*, offered as a download chip
under its reply. `chat/exports.py` is the writer (rows → bytes, pure, no Frappe
documents — the mirror of `attachments.py`), `chat/artifacts.py` is the Frappe
side, and `create_download` is the tool the model calls. xlsx, csv and pdf.

```
model calls create_download  ──▶ artifacts.create  ──▶ save_file(… "OS Chat Session" …)
                                        │
                          record() on frappe.local │
                                        ▼
        runner._loop  ──▶ drain()  ──▶ _append(assistant, attachments=[…])
                                        │
                          api/chat._present ──▶ the chip, with its file_url
```

**The channel is the `attachments` column, and that is not an accident.** A tool's
*result* never reaches the client, so a `file_url` returned from a tool would be
seen by the model and by nobody else. What `_present` does ship per message is
`attachments` — which already carries uploads, already draws a chip, and has room
for a `kind` marker. So a generated file rides the same column, tagged
`kind: "artifact"`.

The collector in between exists because the two events are one iteration of
`_loop` apart. A tool runs *after* the `stop_reason` check, so a drain is always
followed by another pass — which puts the chip on the message where the model says
"here it is", rather than on the tool-result message, which is `role: user` and
would render as though the user had attached it. The out-of-turns path drains too:
a turn that wrote a file on its twelfth step has the bytes on disk, and dropping
the meta leaves them unreachable by anyone.

`kind` is read in exactly one place that matters. `_elide_old_attachments` finds an
upload's blocks **by position** — the first `len(meta)` of the message — and on an
assistant message those blocks are prose and `tool_use`. Stubbing them would orphan
the `tool_result` paired with that `tool_use`, which the API rejects outright, so a
session would break permanently on its *second* export. Artifact meta is therefore
excluded from elision entirely, tested as `kind == "artifact"` and never as
`!= "upload"`: every row written before the marker existed has no `kind` at all.

**The rows come from the model, inline.** It passes the table it already retrieved;
it does not name an earlier tool call for the server to re-run. There is no handle
to name (results are not stored as retrievable values, and `_truncate` means the
model only ever saw a prefix), and a re-run is a second execution of a live tool —
a second audit-log row, a second permission evaluation, and a different answer if
the data moved, so the file would disagree with the reply above it. Inline means
the file contains exactly the numbers in the message, which is the only property
that makes a download trustworthy in a system whose prompt already says "never
invent figures".

What that gives up is a **genuinely bulk export** — "every order last month" is
refused, not served. Deliberate, for now: the answer for fifty thousand rows is a
scheduled report, not a chat message. The route to it later is a
`source: {tool, arguments}` variant that re-runs a data tool server-side; nothing
in the artifact plumbing or the meta shape has to change when it lands. Note that a
tenant's own tools cap their row counts for the model's benefit
(`alaiy_os_globali/chat_tools.py` caps every breakdown at 25), so that work needs an
export-path limit on those endpoints too — the writer's cap is not the binding one.

**A tool schema has to survive every provider on the `ai_client` seam**, not just
Anthropic's. The default model is reached through LiteLLM in front of Gemini,
whose function declarations are an OpenAPI subset: a `"type"` union like
`["string", "number", "null"]` is rejected outright, reported as a *missing
field* on the node below it. So a cell in `create_download`'s `rows` is declared
as a plain `"string"`, and nothing is lost — `exports.normalise` stringifies
every cell anyway, and `_typed` turns a figure back into a real number when
writing xlsx, so a model that sends `412000.5` and one that sends `"412000.5"`
produce the same spreadsheet. Keep new tool schemas to single types.

`create_download` is core's first own tool, contributed through `_core_tools()` in
the same shape a tenant source uses. It is **not** privileged: its name goes through
every tenant `filter` alongside FAC's, so a deployment can withhold it — and one
that scopes its users to a subset of the generic surface has to name it to keep it
(`alaiy_os_globali` does).

**Exports are request-driven, and that is a cost decision rather than caution.**
Claude's artifacts and ChatGPT's Code Interpreter both produce files unprompted,
and both can afford to — an artifact *is* the answer, written once, and Code
Interpreter's file falls out of code that already ran. Here the model retypes
every row as tool arguments, so an unrequested export pays for the same data
twice: once in the prose, once in the call. A row threshold in the style of
Claude's artifacts is the right rule the moment `create_download` can take a
`source: {tool, arguments}` and let the server export what it already fetched.
Until then `DOWNLOAD_PROMPT` says to create a file when asked and not otherwise.

**The model is told the file exists and nothing else** — not its name, not its
location. That is not tidiness, it is a fix for observed behaviour: given only the
name `top-skus-8c7051.xlsx`, gemini-3.1-flash-lite wrote
`[top_skus.xlsx](sandbox:/tmp/top_skus-8c7051.xlsx)` into its reply, inventing a
plausible path around the name, hash included. A system-prompt clause forbidding
it did not stop that. A name that was never supplied cannot be built into a path,
so the return value withholds it and the chip — which is where the user reads the
name anyway — carries it instead. Prose refers to "the Excel file" perfectly well
without it.

The oversize path is the ordinary tool-failure path: `create_download` raises,
`_run_tools` turns that into a `tool_result` marked `is_error`, the model reads the
cap and narrows or switches format, and nothing was written to disk. Every message
names the real number, and the format to switch to where one would help.

## Why it doesn't need MCP

MCP is a wire format over Frappe Assistant Core's tool registry. In-process,
`get_tool_registry().get_available_tools(user)` and `.execute_tool(name, args)`
are the same two operations an MCP client performs over the transport — with
the same permission filtering (FAC Tool Configuration, roles, Frappe document
permissions) and the same `Assistant Audit Log` rows. `chat/tools.py` calls them
directly and adds no checks of its own.

FAC stays an optional dependency: `tools.py` returns no tools on a site without
it and the chat still answers, in line with the note in `hooks.py` about why
`frappe_assistant_core` is absent from `required_apps`.

## Charts

A chart is a **prompt convention, not a channel**. `CHART_PROMPT` in `runner.py`
tells the model to emit a fenced ` ```alaiy-chart ` block holding a small JSON
spec, inline in its reply, and the client draws it. Nothing on the server parses
it; no doctype field, no tool, no wire change.

An echo `render_chart` tool was the obvious alternative and is worse on four
counts: it costs a **full extra `llm.complete` round-trip per chart** (the tool
result has to come back before the model can write the prose), it lands the chart
in its own message *before* the prose, it shows up in every client's tool trail
needing a name-based special case there, and the spec re-enters context on replay
anyway since nothing elides `tool_use` blocks. A `charts` JSON column would buy
server-side validation and history elision, at the cost of a migration and of the
inline ordering that is the whole point.

The prompt is unconditional because there is no tool behind it to be permitted or
withheld, and a client that does not draw charts renders the block as a table
instead — which is what the desk page does. Validation is the client's job and
must be total: the model will sometimes emit a malformed or absurd spec, and that
may never take a chat panel down.

If replay cost proves real — measure `input_tokens` on chart-heavy sessions — the
fix is fence-to-stub elision alongside `_elide_old_attachments`, a pure backend
change that never touches the client contract, since a client only ever needs the
newest message's fence intact.

## Why it doesn't reuse `engine/executor.py`

It reuses the part that matters — `engine.llm.complete()`, i.e. the `ai_client`
hook, so provider choice and per-customer billing stay on one seam.

It does not reuse the run lifecycle, because the shapes differ:

| | `engine/executor.py` (batch) | `chat/runner.py` |
|---|---|---|
| unit | `OS Agent Run`: one input → one output | a session of many turns |
| tools | fixed handlers on an `OS Agent Registry` row | whatever FAC allows *this user*, resolved per call |
| ending | JSON-schema validation + one retry | prose, whenever the model stops asking for tools |
| on failure | roll back, transcript is debug output | keep what was written; the history is the artefact |
| persistence | one transcript blob at the end | each step committed as it happens, so polling shows progress |

## Rules that carry over

- **No LLM call in a web request.** `start_turn` writes the user's message and
  enqueues; `run_turn` does the work on the `long` queue. A turn with a tool
  chain outlives any sane request timeout.
- **A tool failure goes back to the model**, as a `tool_result` with
  `is_error`, not up the stack. A denied permission or a bad argument is
  something it can respond to.

## Storage

A tool round-trip is not its own doctype. It is an assistant message whose
blocks contain `tool_use`, followed by a user message whose blocks are
`tool_result` — the Anthropic wire shape exactly, so replaying history is a
`json.loads` per row and nothing translates. `OS Chat Message.text` is the
denormalised text blocks, for display only.

Deleting a session deletes its messages and any staged attachments
(`OSChatSession.on_trash`), after which Frappe's own cascade unlinks the uploaded
Files. Both deletes must stay in `on_trash` rather than `after_delete`:
`delete_doc` runs `on_trash`, *then* the link check, then removes attachments.

## One turn at a time

`start_turn` refuses while a session is `Running`, and the enqueue is
deduplicated on `job_id=f"os-chat-{session}"` to close the gap between that
check and the job actually being queued. Two browser tabs cannot interleave
turns into one conversation.

## Limits

- `MAX_HISTORY_MESSAGES` (60) — older messages fall off the front of each
  request. The trim heals its seam so a `tool_result` is never orphaned from
  its `tool_use`; the API rejects that outright.
- `MAX_TOOL_RESULT_CHARS` (20k) — a truncated result is marked as such, and the
  model can re-query more narrowly.
- `chat_max_turns` (12) — hitting it ends the turn with a message saying so,
  not a failure: the history is still valid, so the user can just reply.

Export limits live in `chat/exports.py`: 5,000 rows, 50 columns and 50,000 cells
per file, 500 chars per cell (truncated in place), 5 MB per file after generation,
3 files per turn — and **500 rows for a pdf**, which is the load-bearing one: it is
the only cap bounding a *subprocess*, since `get_pdf` shells out to wkhtmltopdf
with no timeout parameter. None of them is the first cap in practice; the model's
own output limit is, because every cell costs output tokens to write.

Attachment limits live in `chat/attachments.py`: 10 MB per file (or the site's
`max_file_size`, whichever is lower — see `upload_limit`), 5 files per message,
20k extracted chars per file and 40k per message, 200 PDF pages and 2,000 rows
per sheet.

Note which limit does what. The **char** caps are what bound context cost: a 9 MB
CSV and a 300 KB CSV are both truncated to the same 20k characters, so the size
limit barely touches token spend. What the size, page and row caps bound is
*work* — extraction runs synchronously in the upload request, and an `.xlsx` is a
zip. Of those, the page and row caps are the better-aimed ones; bytes correlate
weakly with parse time, since a dense 2 MB text PDF can take longer than an 8 MB
PDF that is mostly one embedded scan.

- `ATTACHMENT_MEMORY` (1) — only the most recent turn with an **inlined**
  attachment keeps its contents on replay; older ones collapse to a named stub.
  Within a turn the document is re-sent on every pass of `_loop`, which is
  unavoidable — the model is still working with it — but carrying every document
  a session has ever seen into every future turn is pure cost. The blocks are
  found by position (the first `len(attachments)` of the message), never by
  parsing their text back out.

  `tool`-mode attachments are exempt: they are already pointers, and stubbing one
  would strip the `file_url` that is the model's only route back to a file it may
  be asked about again many turns later. So are `kind: "artifact"` rows, for a
  stronger reason — the positional rule does not hold for them at all, and
  applying it would orphan a `tool_result`. See **Generated files**.

Most of the limits above are therefore an `inline`-mode concern. On the `tool`
path the reader's own ceilings apply instead — 50 MB and a `max_pages` argument
defaulting to 50 — and `MAX_CHARS_PER_FILE` never enters into it.

## Testing a turn without the UI

```bash
bench --site <site> execute alaiy_os.chat.smoke.run
bench --site <site> execute alaiy_os.chat.smoke.run --kwargs "{'question': '...', 'user': 'x@y.com'}"
```

Runs the loop in-process — no worker, no browser, traceback on stdout instead
of in the Error Log. Costs one real LLM call.

## site_config keys

| key | default | effect |
|---|---|---|
| `chat_model` | `gemini-3.1-flash-lite` | model for new sessions (per-session override on the record) |
| `chat_max_turns` | 12 | LLM calls per user message |
| `chat_tools` | unset | allow-list of tool names; unset = everything the user may call |
| `chat_system_prompt` | built-in | replaces the whole system prompt |

To *add* to the prompt rather than replace it — a deployment's currency, date
format, marketplaces, role map — a tenant app registers the `chat_system_context`
hook (a dotted path to a no-argument callable returning a paragraph). Several
apps may each contribute one. `chat_system_prompt` overrides everything,
including those, which is why it is checked first.

The other tenant seams are `chat_mention_sources` — what a user can name with
`@` (see **Mentions** above) — and `chat_tool_sources` / `chat_skill_filter`,
which decide what the assistant may *read*.

Those last two exist because FAC's checks are Frappe's: a role holds a
doctype's read permission or it does not. A deployment scoping rows more
narrowly than that — brands assigned per user, where the brand hangs off the
Item behind an order line rather than the order — cannot express it in the
registry, so a generic tool hands such a user the whole dataset. A source may
narrow the tool list, and may contribute tools of its own that apply the
deployment's real scoping. `chat_skill_filter` does the same for `/skills`.

Both **fail closed**, unlike the two hooks above: a broken source leaves the
assistant with no tools rather than the unscoped set, because degrading open
there is a disclosure and not a cosmetic loss. Symptom is an assistant that
says it has no tools; cause is in the Error Log under the source's name. See
`tools.py` and `skills.py` for the full contract.

`chat_tools` in site_config composes with them, and applies first: a site that
pins that list is stating the complete surface, so a tenant-contributed tool
has to be named there too before anyone can reach it.

The provider key itself is not here — that is `ai_api_key` / `ai_base_url` on
the `ai_client` seam (see `engine/AI_CLIENT.md`), shared with batch agents.
