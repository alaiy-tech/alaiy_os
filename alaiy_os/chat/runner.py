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

from alaiy_os.chat import attachments as chat_attachments
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

# How many *inlined* attachment-bearing user messages keep their file contents
# on replay. Within one turn the document has to be re-sent on every iteration
# of `_loop` — the model needs it while it works through its tool calls — but
# carrying it across later turns forever is pure cost. Attachments passed as
# tool pointers are exempt: they are already tiny, and eliding one would strip
# the file_url the model needs to read it again. See `_elide_old_attachments`.
ATTACHMENT_MEMORY = 1


# ── Entry points ─────────────────────────────────────────────────────────────
def default_model():
	"""Model for a new session. Per-session overrides live on the record."""
	return frappe.conf.get("chat_model") or DEFAULT_MODEL



def start_turn(session, text, attachments=None):
	"""Append the user's message and enqueue the turn. Returns the message seq.

	`attachments` is a list of `OS Chat Attachment` names staged by
	`api.chat.upload_attachment`. Their extracted text is inlined ahead of the
	user's own words as ordinary text blocks — the model never sees a file, only
	a document quoted into the conversation.

	Safe to call from a web request — it does no LLM work itself. The files were
	already parsed at upload time, so nothing expensive happens here.
	"""
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("write")
	if doc.status == "Running":
		frappe.throw("This chat is still working on the previous message.")

	text = (text or "").strip()
	att_blocks, meta, consumed = _attachment_blocks(session, attachments)
	if not text and not att_blocks:
		frappe.throw("Message is empty.")

	blocks = att_blocks + ([{"type": "text", "text": text}] if text else [])
	# `text=text` and not `_text_of(blocks)`: the attachment content must stay
	# out of the denormalised column, or a whole PDF ends up rendered in the
	# user's chat bubble and sliced into the session title below.
	seq = _append(session, "user", blocks, text=text, attachments=meta)

	if consumed:
		# The staging rows have done their job — the message's blocks are now
		# the record of what was sent. Raw delete: the uploaded Files are
		# attached to the session, not to these rows, so they stay put and the
		# sent message's chips keep working.
		frappe.db.delete("OS Chat Attachment", {"name": ("in", consumed)})

	updates = {"status": "Running", "error": None, "last_activity": now_datetime()}
	if not doc.title:
		# An attachment-only message still deserves a name in the rail.
		updates["title"] = (text or meta[0]["file_name"])[:TITLE_LENGTH]
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


# ── Attachments ──────────────────────────────────────────────────────────────
def _attachment_blocks(session, names):
	"""Resolve staged uploads into (blocks, display meta, consumed row names).

	Two modes, decided once here by whether this user can call FAC's file reader:

	  - "tool": the block is a pointer and the model calls `extract_file_content`
	    to read the file itself. Preferred — it costs a few dozen tokens instead
	    of up to 20k, puts no ceiling on how much of the file is reachable, and
	    picks up table extraction and OCR that this module does not do.
	  - "inline": the extracted text goes straight into the block. The fallback
	    for a site without FAC, or with the data_science plugin off — which is
	    most of the point, since FAC is deliberately optional (see tools.py).

	The choice is recorded per attachment in the meta rather than re-derived,
	because a block already written must keep meaning what it meant: whether the
	tool was available when the message was sent is not the same question as
	whether it is available now.

	The blocks always come first in the message and always number `len(meta)` —
	`_elide_old_attachments` relies on that to find them again by position
	rather than by sniffing their text.
	"""
	names = names or []
	if isinstance(names, str):
		names = json.loads(names or "[]")
	if not names:
		return [], [], []

	# Resolved once: tool_specs() re-queries FAC's registry on every call.
	available = {spec["name"] for spec in chat_tools.tool_specs()}
	use_tool = chat_attachments.FILE_TOOL in available
	can_run_code = use_tool and chat_attachments.CODE_TOOL in available

	if len(names) > chat_attachments.MAX_ATTACHMENTS_PER_MESSAGE:
		frappe.throw(
			f"Attach at most {chat_attachments.MAX_ATTACHMENTS_PER_MESSAGE} files to one message."
		)

	blocks, meta, consumed = [], [], []
	budget = chat_attachments.MAX_CHARS_PER_MESSAGE

	for name in names:
		row = frappe.db.get_value(
			"OS Chat Attachment",
			name,
			[
				"name",
				"owner",
				"session",
				"file",
				"file_name",
				"file_size",
				"char_count",
				"extracted_text",
			],
			as_dict=True,
		)
		# The session match is the real check — it is the session's own
		# permission (already asserted by the caller) that authorises the read.
		# The owner match is cheap depth on top of it. Nothing here trusts a
		# client-supplied file_url: `save_file` de-duplicates by content hash,
		# so one URL can belong to several users' uploads.
		if not row or row.session != session or row.owner != frappe.session.user:
			frappe.throw("That attachment is not available on this chat.")

		entry = {
			"file_name": row.file_name,
			"file_url": frappe.db.get_value("File", row.file, "file_url") if row.file else None,
			"file_size": row.file_size,
			"mode": "tool" if use_tool else "inline",
		}
		consumed.append(row.name)

		if use_tool:
			# Nothing is quoted into the message, so the char budget does not
			# apply — five pointers cost less than one inlined page.
			entry["chars"] = row.char_count or 0
			meta.append(entry)
			blocks.append(chat_attachments.pointer_block(entry, can_run_code=can_run_code))
			continue

		text = row.extracted_text or ""
		if len(text) > budget:
			text = text[:budget] + f"\n… [truncated, {len(row.extracted_text)} chars total]"
		budget -= len(text)

		entry["chars"] = len(text)
		meta.append(entry)
		blocks.append(chat_attachments.render_block(row.file_name, text))

		if budget <= 0:
			# Everything after this would be an empty quotation. Better to send
			# fewer whole files than several empty ones.
			break

	return blocks, meta, consumed


def _elide_old_attachments(rows):
	"""Strip file contents from all but the most recent attachment-bearing turn.

	`_loop` re-reads the history on every iteration, so an attachment is re-sent
	on each pass of the current turn — unavoidable, the model is still working
	with it. What is avoidable is carrying every document the session has ever
	seen into every future turn. Older ones collapse to a named stub the model
	can ask the user to re-attach.
	"""
	messages = []
	kept = 0
	# Newest first, so "the most recent N" is just a counter.
	for row in reversed(rows):
		blocks = json.loads(row.blocks or "[]")
		meta = json.loads(row.attachments or "[]")

		# Only inlined attachments are worth eliding. A "tool" attachment is
		# already a pointer costing a few dozen tokens, and stubbing it would
		# destroy the file_url — the model's only route back to a file it may
		# well be asked about again several turns later.
		inlined = [m for m in meta if m.get("mode") != "tool"]

		if inlined:
			if kept < ATTACHMENT_MEMORY:
				kept += 1
			else:
				# Attachment blocks are the first len(meta) entries — see
				# `_attachment_blocks`. Positional, so nothing depends on
				# parsing the text back out.
				blocks = [
					chat_attachments.stub_block(m) if m.get("mode") != "tool" else block
					for m, block in zip(meta, blocks)
				] + blocks[len(meta) :]

		messages.append({"role": row.role, "content": blocks})

	messages.reverse()
	return messages


# ── Persistence ──────────────────────────────────────────────────────────────
def _append(session, role, blocks, text=None, attachments=None):
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
			"attachments": json.dumps(attachments) if attachments else None,
		}
	).insert(ignore_permissions=True)
	return seq


def _history(session):
	"""The conversation in Anthropic wire form, trimmed to fit."""
	rows = frappe.get_all(
		"OS Chat Message",
		filters={"session": session},
		fields=["role", "blocks", "attachments"],
		order_by="seq asc",
	)
	return _trim(_elide_old_attachments(rows))


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
