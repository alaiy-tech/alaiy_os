"""The conversational LLM ⇄ tool loop behind Ask Alaiy.

One user message drives one *turn*: the model is called, it may call tools, it
is called again with the results, and so on until it answers in prose. Every
step is persisted as an `OS Chat Message` and committed before the next LLM
call, so a poll mid-turn sees the tool calls as they happen and a crash leaves a
readable partial conversation rather than nothing.

Relationship to `alaiy_os.engine`:

  - The LLM call goes through `engine.llm.complete()`, i.e. the `ai_client`
    hook. That seam is where BYOK vs. the managed LiteLLM proxy is decided and
    where per-customer spend is attributed; a second provider path here would be
    an unbilled one.
  - The run lifecycle is deliberately NOT `engine.executor`. That module serves
    one-shot batch agents — an `OS Agent Run` is one input to one final output,
    its tools are fixed dotted-path handlers on an `OS Agent Registry` record,
    and it ends with JSON-schema validation. A conversation is multi-turn, its
    tool list is resolved per-user at call time from FAC, and its history is the
    artefact rather than a debug transcript.

Turns run in a background worker: nothing here may be called from a web request
(same rule the executor states, for the same reason — an LLM call plus a tool
chain outlives any sane request timeout).
"""

import json
import traceback

import frappe
from frappe.utils import now_datetime

from alaiy_os.chat import tools as chat_tools
from alaiy_os.engine import llm

DEFAULT_MODEL = "gemini-3.1-flash-lite"
DEFAULT_MAX_TURNS = 12
TITLE_LENGTH = 80

# A single tool can return a whole report. Past a point that is context the
# model cannot use and the customer still pays for, so the result is truncated
# with a visible marker — the model can re-query more narrowly when it matters.
MAX_TOOL_RESULT_CHARS = 20_000

# Every turn re-sends the conversation, so an unbounded session eventually
# exceeds the context window (and costs a fortune on the way there). Older
# messages fall off the front; see `_history`.
MAX_HISTORY_MESSAGES = 60


# ── Entry points ─────────────────────────────────────────────────────────────
def default_model():
	"""Model for a new session. Per-session overrides live on the record."""
	return frappe.conf.get("chat_model") or DEFAULT_MODEL



def start_turn(session, text):
	"""Append the user's message and enqueue the turn. Returns the message seq.

	Safe to call from a web request — it does no LLM work itself.
	"""
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("write")
	if doc.status == "Running":
		frappe.throw("This chat is still working on the previous message.")

	text = (text or "").strip()
	if not text:
		frappe.throw("Message is empty.")

	seq = _append(session, "user", [{"type": "text", "text": text}], text=text)

	updates = {"status": "Running", "error": None, "last_activity": now_datetime()}
	if not doc.title:
		updates["title"] = text[:TITLE_LENGTH]
	doc.db_set(updates)

	frappe.enqueue(
		"alaiy_os.chat.runner.run_turn",
		queue="long",
		session=session,
		enqueue_after_commit=True,
		# One turn in flight per session. The status check above already refuses
		# while Running, but it and the enqueue are not atomic across two
		# concurrent requests; this closes the window. A dropped duplicate does
		# not strand the session: the job that won is either still queued (it
		# will read this message too — `_loop` re-reads history every iteration)
		# or already running (it sets the session Idle when it finishes), so the
		# user can always send again.
		job_id=f"os-chat-{session}",
		deduplicate=True,
	)
	return seq


def run_turn(session):
	"""Worker entry point: drive one turn to completion."""
	doc = frappe.get_doc("OS Chat Session", session)

	# The job normally arrives already running as the session's user (enqueue
	# carries frappe.session.user). Pin it anyway: everything below — the tool
	# list, every tool call, every audit-log row — is scoped by the current
	# user, and a turn that silently ran as Administrator would be both a
	# privilege escalation and a lie in the audit trail.
	if frappe.session.user != doc.owner:
		frappe.set_user(doc.owner)

	try:
		_loop(doc)
	except Exception:
		# Messages already written stay written — unlike a batch run, the
		# conversation so far is the thing of value, and the user needs to see
		# where it got to.
		frappe.db.rollback()
		doc.reload()
		doc.db_set(
			{"status": "Failed", "error": traceback.format_exc(), "last_activity": now_datetime()},
			commit=True,
		)
		frappe.log_error(title=f"OS Chat Session {session} turn failed")
		return

	doc.reload()
	doc.db_set({"status": "Idle", "last_activity": now_datetime()}, commit=True)


# ── The loop ─────────────────────────────────────────────────────────────────
def _loop(doc):
	specs = chat_tools.tool_specs()
	system = _system_prompt()
	max_turns = int(frappe.conf.get("chat_max_turns") or DEFAULT_MAX_TURNS)
	model = doc.model or default_model()

	for _ in range(max_turns):
		messages = _history(doc.name)
		response = llm.complete(model, system, messages, tools=specs or None)
		_record_usage(doc, response.get("usage") or {})

		blocks = response["content"]
		_append(doc.name, "assistant", blocks, text=_text_of(blocks))
		frappe.db.commit()

		if response.get("stop_reason") != "tool_use":
			return

		results = _run_tools(blocks)
		_append(doc.name, "user", results)
		frappe.db.commit()

	# Out of turns with the model still reaching for tools. Say so in the
	# conversation rather than failing the session: the history is valid (it
	# ends with tool results), so the user can just reply and carry on.
	note = (
		f"I stopped after {max_turns} steps without reaching an answer. "
		"Try narrowing the question."
	)
	_append(doc.name, "assistant", [{"type": "text", "text": note}], text=note)
	frappe.db.commit()


def _run_tools(blocks):
	"""Execute every tool_use block, returning the matching tool_result blocks."""
	results = []
	for block in blocks:
		if block.get("type") != "tool_use":
			continue
		try:
			value = chat_tools.call_tool(block["name"], block.get("input") or {})
			content = _truncate(json.dumps(value, default=str))
			results.append(_tool_result(block["id"], content))
		except Exception as exc:
			# Tool failures go back to the model, not up the stack: a rejected
			# permission or a bad argument is something it can respond to.
			# Only the message, not the traceback — the user can see this text.
			results.append(_tool_result(block["id"], f"{type(exc).__name__}: {exc}", is_error=True))
	return results


def _tool_result(tool_use_id, content, is_error=False):
	result = {"type": "tool_result", "tool_use_id": tool_use_id, "content": content}
	if is_error:
		result["is_error"] = True
	return result


def _truncate(text):
	if len(text) <= MAX_TOOL_RESULT_CHARS:
		return text
	return text[:MAX_TOOL_RESULT_CHARS] + f"\n… [truncated, {len(text)} chars total]"


# ── Persistence ──────────────────────────────────────────────────────────────
def _append(session, role, blocks, text=None):
	"""Write one message and return its seq."""
	last = frappe.db.get_value("OS Chat Message", {"session": session}, "seq", order_by="seq desc")
	seq = (last or 0) + 1
	frappe.get_doc(
		{
			"doctype": "OS Chat Message",
			"session": session,
			"seq": seq,
			"role": role,
			"text": text,
			"blocks": json.dumps(blocks, default=str),
		}
	).insert(ignore_permissions=True)
	return seq


def _history(session):
	"""The conversation in Anthropic wire form, trimmed to fit."""
	rows = frappe.get_all(
		"OS Chat Message",
		filters={"session": session},
		fields=["role", "blocks"],
		order_by="seq asc",
	)
	messages = [{"role": row.role, "content": json.loads(row.blocks)} for row in rows]
	return _trim(messages)


def _trim(messages):
	"""Keep the tail, then heal the seam.

	Cutting mid-turn can orphan a `tool_result` from the `tool_use` that
	produced it, which the API rejects outright. So after taking the tail, drop
	from the front until the conversation opens on a plain user message.
	"""
	if len(messages) <= MAX_HISTORY_MESSAGES:
		return messages

	trimmed = messages[-MAX_HISTORY_MESSAGES:]
	while trimmed and not _is_plain_user_message(trimmed[0]):
		trimmed.pop(0)
	# Every dropped message was one the model can no longer see; if that ate
	# everything, fall back to the last user turn we can find intact.
	return trimmed or [m for m in messages if _is_plain_user_message(m)][-1:]


def _is_plain_user_message(message):
	if message["role"] != "user":
		return False
	content = message["content"]
	if not isinstance(content, list):
		return True
	return not any(block.get("type") == "tool_result" for block in content)


def _record_usage(doc, usage):
	frappe.db.set_value(
		"OS Chat Session",
		doc.name,
		{
			"input_tokens": (doc.input_tokens or 0) + (usage.get("input_tokens") or 0),
			"output_tokens": (doc.output_tokens or 0) + (usage.get("output_tokens") or 0),
		},
		update_modified=False,
	)
	doc.input_tokens = (doc.input_tokens or 0) + (usage.get("input_tokens") or 0)
	doc.output_tokens = (doc.output_tokens or 0) + (usage.get("output_tokens") or 0)


# ── Prompt ───────────────────────────────────────────────────────────────────
def _text_of(blocks):
	return "\n".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()


def _system_prompt():
	if frappe.conf.get("chat_system_prompt"):
		return frappe.conf.get("chat_system_prompt")

	user = frappe.session.user
	full_name = frappe.utils.get_fullname(user)
	roles = ", ".join(sorted(r for r in frappe.get_roles(user) if r not in ("All", "Guest")))
	company = frappe.defaults.get_global_default("company") or "the company"

	return (
		"You are Alaiy, the assistant built into Alaiy OS — the e-commerce operations "
		f"system {company} runs its catalogue, stock, orders and sales channels on.\n\n"
		f"You are talking to {full_name} ({user}), whose roles are: {roles or 'none'}.\n"
		f"Today is {frappe.utils.today()}.\n\n"
		"Your tools read and write this business's REAL, LIVE data — orders that ship, "
		"stock that gets counted, listings customers see. Treat them accordingly:\n"
		"- Prefer reading over writing. Look before you change anything.\n"
		"- Before any action that creates, cancels, submits or publishes, state what you "
		"are about to do and wait for the user to confirm in their next message.\n"
		"- A tool may refuse on permissions. That is the system working; explain what "
		"the user would need, do not look for another route to the same effect.\n"
		"- Never invent figures. If you have not read a number with a tool, say so.\n\n"
		"Answer in plain prose. Be concise and specific — cite the document names and "
		"numbers you actually retrieved."
	)
