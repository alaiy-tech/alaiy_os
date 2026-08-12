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
| `send_message` | `session`, `text?`, `attachments?` | `{seq, status}` — queues the turn, returns immediately |
| `get_messages` | `session`, `after=0` | `{status, error, messages[]}` — the poll endpoint |
| `list_sessions` | `limit=50` | the caller's sessions, newest first |
| `delete_session` | `session` | `{deleted}` |
| `upload_attachment` | `session` + a multipart `file` | `{name, file_name, file_url, file_size, chars}` |
| `delete_attachment` | `attachment` | `{deleted}` — drops a staged upload |
| `list_tools` | — | what this user's assistant can do |

The flow is: `create_session` once, then per question `send_message` → poll
`get_messages(after=<highest seq seen>)` until `status` leaves `Running`.
Messages arrive as they are committed, so tool calls show up before the answer.

A message is `{seq, role, text, attachments[], tool_calls[], tool_errors[]}`.
`tool_calls` is `{id, name, input}` per tool the assistant invoked; a tool's
*result* is not returned — it is raw JSON the model has already summarised in its
reply, and can be megabytes. Read `OS Chat Message.blocks` directly if you need
it. `attachments` is `{file_name, file_url, file_size, chars}` per file sent with
that message — enough to draw a chip, not the contents.

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
  be asked about again many turns later.

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

The provider key itself is not here — that is `ai_api_key` / `ai_base_url` on
the `ai_client` seam (see `engine/AI_CLIENT.md`), shared with batch agents.
