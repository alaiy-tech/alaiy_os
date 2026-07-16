# Agent Core — Building Agents on Alaiy OS

Agent Core is the platform machinery for running AI agents on an Alaiy OS site.
This document is the spec for building one: what an agent is, how it executes,
and the contract every piece must honor.

---

## 1. The core rule: agents are data, tools are code

| Thing | Data or code? | Where it lives |
|---|---|---|
| An **agent** (prompt, model, tool list, output format) | **Data** | an `OS Agent` record, created in Desk or via API |
| A **tool** (the Python that does something) | **Code** | a module in this app (or a connector app), registered as an `OS Agent Tool` record |
| The **engine** (run lifecycle, LLM ⇄ tool loop) | **Code** | `agent_core/engine/` — written once, never per-agent |
| A **run** (one execution: status, output, tokens) | **Data** | an `OS Agent Run` record, created by the engine |

Consequences of the rule:

- **An agent is never its own app or module.** Creating an agent means inserting
  an `OS Agent` record. If you're writing Python to "build an agent", you're
  actually building a *tool* — or you're doing it wrong.
- **There is exactly one way to run an agent**: `execute_agent()`. No direct
  dotted-path invocation, no side channels. Every run leaves an `OS Agent Run`.
- **Apps that ship prebuilt agents register data, not code**: provision
  `OS Agent` / `OS Agent Tool` records in `after_install`, the same way
  connector apps provision `OS Connector Registry` rows.

---

## 2. The DocTypes

### OS Agent — the agent definition

| Field | Type | Notes |
|---|---|---|
| `agent_id` | Data, unique | Document name (`autoname: field:agent_id`). Use kebab-case, e.g. `pricing-watchdog`. |
| `is_enabled` | Check (default 1) | Disabled agents refuse to run. |
| `model` | Data (default `claude-sonnet-5`) | Anthropic model id. |
| `max_turns` | Int (default 8) | Max LLM ⇄ tool round-trips. Exceeding it **fails the run**. |
| `system_prompt` | Text, required | The agent's instructions. |
| `tools` | Table → OS Agent Tool Link | Which registered tools this agent may call. |
| `output_format` | Select: `Text` / `JSON` | `JSON` enables schema validation (§5). |
| `output_schema` | Code (JSON) | JSON Schema for the final output. Required when `output_format = JSON`. |

### OS Agent Tool — a registered Python capability

| Field | Type | Notes |
|---|---|---|
| `tool_id` | Data, unique | Document name. This is the tool name the LLM sees. |
| `description` | Small Text, required | Written **for the LLM** — it decides when to call the tool based on this. Be specific about what it does and returns. |
| `handler` | Data, required | Python dotted path, e.g. `alaiy_os.agent_core.tools.pricing.fetch_competitor_prices`. Resolved with `frappe.get_attr` at run time. |
| `parameters_schema` | Code (JSON) | JSON Schema for the tool's arguments. Empty = no-argument tool. |
| `connector` | Link → OS Connector Registry | Optional: which connector this tool belongs to. |
| `is_enabled` | Check (default 1) | An agent referencing a disabled tool **fails at build time** — fix the wiring, don't silently skip. |

### OS Agent Run — one execution

Named `RUN-{YYYY}-{#####}`. The engine owns every field; treat it as read-only.

| Field | Notes |
|---|---|
| `agent`, `trigger_type` | Link to the agent; `Manual` / `API` / `Scheduled` / `Doc Event`. |
| `status` | `Queued` → `Running` → `Success` or `Failed`. |
| `input` / `output` / `error` | Payload in; final text (or validated JSON) out; traceback on failure. |
| `input_tokens` / `output_tokens` | Summed across all LLM calls in the run. |
| `transcript` | Full message history — your first stop when debugging a run. |
| `started_at` / `ended_at` | Timings. |

All three DocTypes are **System Manager only** by default. Widening access is a
deliberate decision, made per-role on the DocType — never by sprinkling
`ignore_permissions` in API code.

---

## 3. How a run executes

```
caller (API / scheduler / doc event / your code)
   │
   ▼
execute_agent(agent, payload, trigger_type)      ← the ONLY entry point
   │  · agent exists & is_enabled, else throw
   │  · insert OS Agent Run (status=Queued, input=payload as JSON)
   │  · frappe.enqueue(run_queued, queue="long", enqueue_after_commit=True)
   │  · return run.name                          ← request ends here, in ms
   ▼
run_queued(run)                                  ← background worker
   │  · status=Running, started_at
   │  · build_runnable(agent):  OS Agent record → RunnableAgent
   │       – resolves each tool's handler via frappe.get_attr
   │       – JSON output? appends schema instructions to the system prompt
   │  · loop (≤ max_turns):
   │       LLM call → stop_reason == "tool_use"?
   │         yes → run handlers, feed tool_results back, loop
   │         no  → done
   │  · JSON output? parse + jsonschema.validate, one corrective retry
   │  · Success: output, transcript, token counts, ended_at
   │  · Any exception: frappe.db.rollback(), then status=Failed + traceback
   ▼
caller polls the Run record until status is Success/Failed
```

Two invariants, both load-bearing:

1. **No LLM call ever runs inside a web request.** `execute_agent()` only
   inserts a record and enqueues. If you find yourself calling
   `llm.complete()` or a handler synchronously from a whitelisted method,
   stop — that holds a gunicorn worker for the duration of the completion.
2. **Failure rolls back the transaction.** If a run raises, any half-done
   tool side effects in that worker transaction are rolled back before the
   failure is recorded. Tools must therefore do their writes through the
   normal Frappe ORM in-transaction — no out-of-band commits.

---

## 4. Building an agent, step by step

Worked example: a pricing watchdog that checks competitor prices for an item.

### Step 1 — Write the tool handler (code)

A handler is a plain Python function. It is **not** whitelisted — the engine
calls it directly, so it must never trust its own popularity: validate inputs.

```python
# alaiy_os/agent_core/tools/pricing.py

import frappe

def get_item_prices(item_code):
    """Return our current selling price(s) for an item."""
    if not frappe.db.exists("Item", item_code):
        return {"error": f"Item {item_code} not found"}
    return frappe.get_all(
        "Item Price",
        filters={"item_code": item_code, "selling": 1},
        fields=["price_list", "price_list_rate", "currency"],
    )
```

The handler contract:

- **Arguments** arrive as keyword args, exactly the properties the LLM filled
  in from your `parameters_schema`. Nothing else is passed — no request
  context, no run object.
- **Return value** must be JSON-serializable (it's `json.dumps`-ed with
  `default=str`, so dates and Decimals survive). Return structured data, not
  prose — the LLM reads it.
- **Exceptions are recoverable.** A raising handler does *not* fail the run;
  the traceback is sent back to the LLM as an `is_error` tool result and it
  may retry or route around. Raise for real failures; return
  `{"error": ...}` for expected ones you want the LLM to reason about.
- **Runs in a background worker** with full `frappe` ambient context (site,
  db) under the session of the user who triggered the run. FastAPI mapping:
  think "dependency-injected DB session", except it's ambient — just
  `import frappe` and use it.

### Step 2 — Register the tool (data)

Insert an `OS Agent Tool` record (Desk → OS Agent Tool → New, or in an app's
`after_install`):

```python
frappe.get_doc({
    "doctype": "OS Agent Tool",
    "tool_id": "get-item-prices",
    "description": "Look up our current selling price(s) for an item code. "
                   "Returns price_list, price_list_rate and currency per price list.",
    "handler": "alaiy_os.agent_core.tools.pricing.get_item_prices",
    "parameters_schema": '{"type": "object", "properties": {"item_code": {"type": "string", "description": "ERPNext Item code"}}, "required": ["item_code"]}',
}).insert()
```

### Step 3 — Create the agent (data — no Python involved)

Desk → OS Agent → New:

- `agent_id`: `pricing-watchdog`
- `system_prompt`: what it is, what good output looks like, when to use which tool
- `tools`: add `get-item-prices` (and the scrape tool, etc.)
- `output_format`: `JSON`, with an `output_schema` if a machine consumes the result

### Step 4 — Run it

```python
from alaiy_os.agent_core.engine.executor import execute_agent

run_name = execute_agent("pricing-watchdog",
                         payload={"item_code": "WIDGET-01"},
                         trigger_type="Manual")
```

or over REST:

```
POST /api/method/alaiy_os.agent_core.api.run_agent
     {"agent": "pricing-watchdog", "payload": "{\"item_code\": \"WIDGET-01\"}"}
  →  {"run": "RUN-2026-00042"}

GET  /api/method/alaiy_os.agent_core.api.get_run?run=RUN-2026-00042
  →  {"status": "Success", "output": "...", "input_tokens": ..., ...}
```

Poll `get_run` until `status` is `Success` or `Failed`. There is no
synchronous variant, by design.

The payload is serialized to JSON and becomes the run's first user message
(`"Run."` if you pass nothing) — so shape it as whatever context the agent's
prompt says to expect.

### Step 5 — Debug with the transcript

Every run stores the full message history in `transcript`: each LLM reply,
each `tool_use` with its inputs, each tool result or error. Read it in Desk
on the Run record before touching any code.

---

## 5. Structured output

Set `output_format = JSON` and provide an `output_schema` (JSON Schema). The
engine then:

1. Appends the schema to the system prompt with "reply with a single JSON
   object, no prose, no code fences".
2. Parses the final reply (code fences are stripped defensively) and
   validates it with `jsonschema`.
3. On failure, sends the validation error back to the LLM for **one**
   corrective retry. A second failure fails the run.

Consumers of a `Success` run with JSON output can `json.loads(run.output)`
without checking — the engine already validated it.

---

## 6. Trigger types and where they come from

| `trigger_type` | Who calls `execute_agent` |
|---|---|
| `API` | `agent_core/api.py::run_agent` (whitelisted, requires *create* on OS Agent Run) |
| `Scheduled` | a scheduler entry in `hooks.py` that calls `execute_agent(...)` |
| `Doc Event` | a doc-event hook (e.g. on Item update) that calls `execute_agent(...)` |
| `Manual` | anything else — bench console, one-off scripts |

All four converge on the same function; the field exists so you can slice Run
history by origin.

---

## 7. Site configuration

| Key (in `site_config.json`) | Purpose |
|---|---|
| `anthropic_api_key` | Required. The engine throws before any run if missing. |

Secrets live in site config or environment — **never** in code, DocType
records, or git. `MAX_TOKENS` is currently fixed at 4096 in `engine/llm.py`.

---

## 8. Guardrails (things that will get your PR bounced)

- **Don't add alternative invocation paths.** No registry of dotted-path
  `invoke_method`s, no whitelisted endpoint that calls a handler or
  `llm.complete()` inline. If a run doesn't produce an `OS Agent Run`, it's a
  bug in the design, not a lighter-weight option.
- **Don't create an app or module per agent.** New app only when a *tool's
  dependencies* need isolation or per-client install gating (the connector
  rule) — and even then the app ships tools + provisions agent *records*.
- **Don't widen access with `ignore_permissions`.** Grant roles on the
  DocTypes, and permission-check whitelisted methods (see `api.py` for the
  pattern).
- **Don't return secrets to the client.** Settings UIs report
  `{"_set": true}` for password fields; there is deliberately no
  "show plaintext" endpoint.
- **Tools that scrape or call third parties** must respect robots.txt, rate
  limits and ToS — that check happens at tool review time, not run time.

---

## 9. File map

```
agent_core/
├── api.py                    # REST: run_agent / get_run
├── doctype/
│   ├── os_agent/             # the agent definition (data)
│   ├── os_agent_tool/        # registered Python capabilities
│   ├── os_agent_tool_link/   # child table: agent → tools
│   └── os_agent_run/         # one execution, engine-owned
└── engine/
    ├── executor.py           # run lifecycle + LLM ⇄ tool loop
    ├── factory.py            # OS Agent record → RunnableAgent
    └── llm.py                # Anthropic Messages API wrapper
```
