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
| `send_message` | `session`, `text` | `{seq, status}` — queues the turn, returns immediately |
| `get_messages` | `session`, `after=0` | `{status, error, messages[]}` — the poll endpoint |
| `list_sessions` | `limit=50` | the caller's sessions, newest first |
| `delete_session` | `session` | `{deleted}` |
| `list_tools` | — | what this user's assistant can do |

The flow is: `create_session` once, then per question `send_message` → poll
`get_messages(after=<highest seq seen>)` until `status` leaves `Running`.
Messages arrive as they are committed, so tool calls show up before the answer.

A message is `{seq, role, text, tool_calls[], tool_errors[]}`. `tool_calls` is
`{id, name, input}` per tool the assistant invoked; a tool's *result* is not
returned — it is raw JSON the model has already summarised in its reply, and can
be megabytes. Read `OS Chat Message.blocks` directly if you need it.

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

Deleting a session deletes its messages (`OSChatSession.on_trash`).

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
| `chat_model` | `claude-sonnet-5` | model for new sessions (per-session override on the record) |
| `chat_max_turns` | 12 | LLM calls per user message |
| `chat_tools` | unset | allow-list of tool names; unset = everything the user may call |
| `chat_system_prompt` | built-in | replaces the whole system prompt |

The provider key itself is not here — that is `ai_api_key` / `ai_base_url` on
the `ai_client` seam (see `engine/AI_CLIENT.md`), shared with batch agents.
