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

from alaiy_os.chat import artifacts as chat_artifacts
from alaiy_os.chat import attachments as chat_attachments
from alaiy_os.chat import mentions as chat_mentions
from alaiy_os.chat import skills as chat_skills
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

# Mentions have no equivalent and are never elided: a mention block is a handful
# of tokens naming a few records, not a document. Dropping it from history would
# make "and how did that brand do the month before?" unanswerable three turns on,
# which is exactly the follow-up mentions exist to make cheap.


# ── Entry points ─────────────────────────────────────────────────────────────
def default_model():
	"""Model for a new session. Per-session overrides live on the record."""
	return frappe.conf.get("chat_model") or DEFAULT_MODEL



def start_turn(
	session, text, attachments=None, skill=None, skill_args=None, screen=None, mentions=None
):
	"""Append the user's message and enqueue the turn. Returns the message seq.

	`attachments` is a list of `OS Chat Attachment` names staged by
	`api.chat.upload_attachment`. Their extracted text is inlined ahead of the
	user's own words as ordinary text blocks — the model never sees a file, only
	a document quoted into the conversation.

	`skill` is an `OS Agent Registry` skill slug (see `chat/skills.py`). It is
	resolved here so an unknown slug is a 417 on the send rather than a failure
	that only shows up in the thread a minute later, but it is *run* on the
	worker — the agent behind it makes its own LLM calls.

	`skill_args` is that skill's arguments, checked against the pack's declared
	Input Schema here for the same reason the slug is: a bad argument belongs on
	the request that made it, not in a thread a minute later. A pack that declares
	no schema takes none, and sending some is an error rather than a silent drop —
	see `skills.validate_args`.

	`mentions` is what the user picked with `@` (see `chat/mentions.py`), as
	`[{kind, value}]`. Every one is re-resolved against its source here, so the
	label and dates that reach the model are the site's rather than the client's,
	and a stale pick is dropped rather than believed. Unlike `skill`, that never
	throws: the user's own words still say what they were asking about.

	`screen` is whatever route the client was on, recorded on the message.

	Safe to call from a web request — it does no LLM work itself. The files were
	already parsed at upload time, so nothing expensive happens here.
	"""
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("write")
	if doc.status == "Running":
		frappe.throw("This chat is still working on the previous message.")

	text = (text or "").strip()
	if skill:
		skill = str(skill).strip().lstrip("/").lower()
		chat_skills.resolve(skill)
		# The words typed alongside the command fill a single required argument,
		# so `/amazon is SKU ABC listed?` works from a picker that knows nothing
		# about this skill's schema. An explicit `skill_args` always wins.
		skill_args = chat_skills.fill_from_text(skill, skill_args, text)
		skill_args = chat_skills.validate_args(skill, skill_args)
		# The message needs words: it is what the user sees in their own bubble,
		# what names the session in the rail, and what the model reads as the
		# request the tool result is answering. Arguments go in the visible text
		# too — a bubble reading just "/amazon" when the user asked about one ASIN
		# loses what they actually asked, both for them and for the model reading
		# it back three turns later.
		text = text or _skill_text(skill, skill_args)
	elif skill_args:
		frappe.throw("skill_args was sent without a skill.")

	att_blocks, meta, consumed = _attachment_blocks(session, attachments)
	if not text and not att_blocks:
		frappe.throw("Message is empty.")

	mention_meta = chat_mentions.resolve(mentions)
	mention_block = chat_mentions.context_block(mention_meta)

	# Attachment blocks MUST stay strictly first: `_elide_old_attachments` finds
	# them by position — the first `len(meta)` entries — and zips the meta
	# against them. Anything inserted ahead would make it stub the wrong block.
	# So mentions go after the documents and before the question they qualify.
	blocks = att_blocks + ([mention_block] if mention_block else [])
	# `text=text` and not `_text_of(blocks)`: the attachment content must stay
	# out of the denormalised column, or a whole PDF ends up rendered in the
	# user's chat bubble and sliced into the session title below.
	blocks += [{"type": "text", "text": text}] if text else []
	seq = _append(
		session,
		"user",
		blocks,
		text=text,
		attachments=meta,
		mentions=mention_meta,
		skill=skill,
		skill_args=skill_args,
		screen=screen,
	)

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

	# After the user is pinned, before anything can write a file. Jobs on the
	# `long` queue share a worker process, so a previous turn that died between
	# writing a file and the drain would otherwise hand its meta to this one.
	chat_artifacts.reset(doc.name)

	try:
		skill, skill_args = _pending_skill(doc.name)
		if skill:
			# Writes the tool_use/tool_result pair, so by the time _loop reads the
			# history the agent's output is the last thing in it and the model's
			# first call is the one that narrates it.
			chat_skills.run_skill(doc.name, skill, _append, args=skill_args)
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


def _skill_text(slug, args):
	"""The user-visible words for a skill send that carried no text of its own.

	`/amazon (asin=B01234)` rather than a JSON blob: this is read by a person in
	their own chat bubble first, and by the model second.
	"""
	if not args:
		return f"/{slug}"
	pairs = ", ".join(f"{k}={v}" for k, v in args.items())
	return f"/{slug} ({pairs})"


def _pending_skill(session):
	"""The slug to dispatch before this turn's first LLM call, if any.

	Read from the last stored message rather than passed through the enqueue,
	because the enqueue is deduplicated on the session (see `start_turn`): a
	second send whose job was dropped must still have its skill run by whichever
	job wins. Once `run_skill` has written its pair the last message is a
	tool_result, so this cannot dispatch the same skill twice.
	"""
	last = frappe.db.get_value(
		"OS Chat Message",
		{"session": session},
		["role", "skill_used", "skill_args"],
		order_by="seq desc",
		as_dict=True,
	)
	if not last or last.role != "user" or not last.skill_used:
		return None, None
	# Stored as text by `_append` and validated on the send, so a parse failure
	# here means the row was edited by hand. Run on defaults rather than killing
	# the turn: the slug is still the user's intent.
	try:
		args = json.loads(last.skill_args) if last.skill_args else None
	except ValueError:
		frappe.log_error(title=f"OS Chat Message skill_args unparseable for {session}")
		args = None
	return last.skill_used, args


# ── The loop ─────────────────────────────────────────────────────────────────
def _loop(doc):
	specs = chat_tools.tool_specs()
	system = _system_prompt(specs)
	max_turns = int(frappe.conf.get("chat_max_turns") or DEFAULT_MAX_TURNS)
	model = doc.model or default_model()

	# Files a tool wrote on the previous pass, owed to the next assistant message.
	# A tool only ever runs *after* the `stop_reason` check below, so a drain is
	# always followed by another iteration — which is what puts the download chip
	# on the message where the model says "here it is", rather than on the
	# tool-result message, which is `role: user` and would render as though the
	# user had attached it.
	pending = None

	for _ in range(max_turns):
		messages = _history(doc.name)
		response = llm.complete(model, system, messages, tools=specs or None)
		_record_usage(doc, response.get("usage") or {})

		blocks = response["content"]
		_append(doc.name, "assistant", blocks, text=_text_of(blocks), attachments=pending)
		pending = None
		frappe.db.commit()

		if response.get("stop_reason") != "tool_use":
			return

		results = _run_tools(blocks)
		pending = chat_artifacts.drain() or None
		_append(doc.name, "user", results)
		frappe.db.commit()

	# Out of turns with the model still reaching for tools. Say so in the
	# conversation rather than failing the session: the history is valid (it
	# ends with tool results), so the user can just reply and carry on.
	note = (
		f"I stopped after {max_turns} steps without reaching an answer. "
		"Try narrowing the question."
	)
	# `attachments=pending` matters here: a turn that wrote a file on its last
	# step has the bytes on disk, and dropping the meta would leave them
	# unreachable by anyone.
	_append(doc.name, "assistant", [{"type": "text", "text": note}], text=note, attachments=pending)
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
			# For symmetry with a generated file's meta, and so the column is
			# self-describing. Nothing may *depend* on it: every row written
			# before this existed has no `kind` at all, which is why
			# `_elide_old_attachments` tests for "artifact" rather than against
			# "upload".
			"kind": "upload",
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

		# `attachments` carries two unrelated kinds. An upload's meta is
		# positional — the first len(meta) blocks ARE its attachment blocks, per
		# `_attachment_blocks`. A generated file's is not: it rides on an
		# assistant message whose blocks are prose and tool_use, and it is a
		# download chip rather than context. Stubbing by position there would
		# destroy the tool_use its following tool_result is paired with, and the
		# API rejects an orphaned tool_result outright — so a session would break
		# permanently on its second export.
		#
		# Tested as `== "artifact"`, never `!= "upload"`: every row written before
		# this marker existed has neither key, and the wrong polarity would stub
		# the whole of an existing history.
		if any(entry.get("kind") == "artifact" for entry in meta):
			meta = []

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
def _append(
	session,
	role,
	blocks,
	text=None,
	attachments=None,
	mentions=None,
	skill=None,
	skill_args=None,
	screen=None,
):
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
			"mentions": json.dumps(mentions) if mentions else None,
			"skill_used": skill,
			"skill_args": json.dumps(skill_args) if skill_args else None,
			"screen": screen,
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

#: Appended only when the user can actually call `create_download`.
#:
#: **Request-driven, deliberately.** Claude's artifacts and ChatGPT's Code
#: Interpreter both hand over files unprompted, and both can afford to: an
#: artifact *is* the answer, written once, and Code Interpreter's file is a
#: byproduct of code that already ran. Here the model retypes every row as tool
#: arguments, so an unrequested export pays for the same data twice — once in the
#: prose, once in the call. A row threshold in the style of Claude's artifacts
#: becomes the right rule once `create_download` can take a `source: {tool,
#: arguments}` and let the server export what it already fetched; until then,
#: proactive exports just make every ordinary answer cost double.
#:
#: "Create" and not "offer", for the same reason. "Offer" reads as an invitation
#: to ask permission, which spends a whole round-trip on a question the user
#: already answered by asking.
#:
#: The "never write a URL" clause is doing real work. The model has just called a
#: tool whose return value names a file, and the pull to render a markdown link
#: to a path it reconstructed by hand is strong — and a broken link is worse than
#: no link, because it looks like the feature failed rather than like the model
#: guessed.
DOWNLOAD_PROMPT = (
	"You can give the user a file to download, with the create_download tool: xlsx, "
	"csv or pdf.\n"
	"- Create one when the user asks for a file, an export, a spreadsheet, a report, "
	"a download, or asks you to 'send' or 'give' them data. Create it in the same "
	"reply — do not ask whether they want it, they just said so.\n"
	"- Otherwise do not create a file, however long your answer is. A table in the "
	"chat is a fine answer on its own, and a file nobody asked for costs the user "
	"tokens and gives them a chip to ignore. If a table is too long to read, say so "
	"and mention you can export it.\n"
	"- Pass the rows you actually retrieved with another tool. Never placeholder or "
	"example data, and never rows you did not read.\n"
	"- Figures go in as plain numbers — no currency symbols, no thousands separators "
	"— so the file stays sortable.\n"
	"- The file is attached to your reply automatically, as a chip the user can "
	"click. You never see where it is stored and you must not invent it: no "
	"markdown link, no file path, no 'sandbox:/tmp/...', no file name. Writing one "
	"is worse than writing nothing, because a link that goes nowhere looks like the "
	"export failed. Just say what the file contains.\n"
	"- xlsx by default; csv when they ask for one or the table is very large; pdf "
	"only when the file is a document to print or forward.\n"
	"- If what you retrieved is empty, do not make a file and do not go hunting for "
	"another source. Say the result was empty and what you looked at — that is the "
	"answer, and an empty spreadsheet is not."
)

#: Appended only when this user's surface actually holds pack tools — the same
#: discipline as DOWNLOAD_PROMPT: never describe a capability the turn lacks.
#:
#: **Why this block exists.** The generic read tools (`list_documents`,
#: `search_documents`, `get_document`, …) can reach almost any doctype, so the
#: model can always assemble *an* answer — and measurably prefers to. Asked "what
#: is the state of my Amazon listings?" with only the generic surface, it spent
#: eight LLM calls and 20k input tokens guessing doctype names (`Amazon Listing`,
#: `Amazon Product` — neither exists) before finding the right one by listing
#: DocType with a LIKE filter. A pack tool answers the same question in one call,
#: because someone who knew the domain wrote its name and its description.
#:
#: `chat/tools.py` already puts pack tools first in the list, which is most of the
#: work; this says out loud why they are there, because ordering alone does not
#: stop a model reaching past them for a tool whose name it recognises.
PACK_PROMPT = (
	"Some of your tools are named `pack__tool` — `amazon_sp_api__get_health_summary`, "
	"for example. The prefix is a connector or a curated area, and each of these was "
	"written for one job by someone who knew that system.\n"
	"- When one covers the question, use it. Do not reach for a generic document tool "
	"instead, and do not reach for one first to 'check' — the prefixed tool already "
	"knows which records hold the answer and what its fields mean.\n"
	"- Read the descriptions before choosing. They say what the tool returns and when "
	"to call it, and picking on the name alone is how you end up calling three.\n"
	"- The generic tools are for everything the prefixed ones do not cover. That is "
	"most of the site, and reaching for them there is right."
)


#: Unconditional: there is no tool behind it, and a client that does not draw
#: charts renders the block as a table instead, so the guidance is safe wherever
#: the assistant is served from.
CHART_PROMPT = (
	"You may draw ONE chart per reply, when a chart genuinely reads better than the "
	"numbers: a trend over time, a comparison across a handful of categories, or a "
	"share of one total. Do not chart a single figure, a pair of figures, a list of "
	"names, or anything the reader would rather read exactly.\n"
	"To draw one, put a fenced block on its own lines, right after the sentence it "
	"illustrates:\n"
	"```alaiy-chart\n"
	'{"type":"bar","title":"Revenue by brand","y":"Revenue","unit":"currency",\n'
	' "labels":["Royal Canin","Pedigree","Whiskas"],\n'
	' "series":[{"name":"Jul","points":[412000,231000,98000]}]}\n'
	"```\n"
	'- "type" is "bar", "line" or "pie"; omit it and the right one is chosen from '
	'the data. "line" for time, "pie" only for a share of one total.\n'
	'- "labels" are the categories or dates. Every series\' "points" must hold '
	"exactly as many numbers as there are labels, in the same order. Use null for a "
	"value you do not have.\n"
	'- "unit" is "number", "currency" or "percent", and decides formatting. Points '
	'are plain numbers: no currency symbols, no commas, no "%" — write 12, never '
	'"12%".\n'
	"- At most 4 series and 60 labels (8 for a pie). Beyond that, chart the top few "
	"and say in prose what you left out.\n"
	"- The reader can flip a chart to a table, so do not also print a markdown table "
	"of the same numbers. Pick one.\n"
	"- Never put a figure in a chart that you did not read with a tool."
)


def _text_of(blocks):
	return "\n".join(b.get("text", "") for b in blocks if b.get("type") == "text").strip()


def _system_prompt(specs=None):
	"""The system prompt for this turn.

	`specs` is the tool surface this user actually has. It is read only to decide
	whether to promise a capability: a prompt that offers a tool the model cannot
	call is a promise the assistant will break in front of the user.
	"""
	if frappe.conf.get("chat_system_prompt"):
		return frappe.conf.get("chat_system_prompt")

	user = frappe.session.user
	full_name = frappe.utils.get_fullname(user)
	roles = ", ".join(sorted(r for r in frappe.get_roles(user) if r not in ("All", "Guest")))
	company = frappe.defaults.get_global_default("company") or "the company"

	prompt = (
		"You are Alaiy, the assistant built into Alaiy OS — the e-commerce operations "
		f"system {company} runs its catalogue, stock, orders and sales channels on.\n\n"
		f"You are talking to {full_name} ({user}), whose roles are: {roles or 'none'}.\n"
		f"Today is {frappe.utils.today()}.\n\n"
		"Your tools read and write this business's REAL, LIVE data — orders that ship, "
		"stock that gets counted, listings customers see. Treat them accordingly:\n"
		"- Prefer reading over writing. Look before you change anything.\n"
		"- Prefer LOCAL writes. Flag the local record and let the connector's own\n"
		"  scheduled push carry the change to the marketplace. The connector's retry\n"
		"  queue and echo suppression apply then; they do not if you call the remote\n"
		"  API yourself, and a failure after a successful external write leaves the\n"
		"  two systems disagreeing in a way nothing here can roll back.\n"
		"- Reads never need permission. Searching, listing, opening a document, running "
		"a report — just do it and answer. Asking 'shall I look that up?' wastes the "
		"user's turn on a question they already answered by asking.\n"
		"- Writes always need it. Before anything that creates, updates, cancels, "
		"submits, deletes or publishes, state exactly what you are about to change — "
		"which records, which fields, what values, how many — and stop. Wait for the "
		"user to confirm in their next message. One confirmation covers the one change "
		"you just described and nothing else: if the plan grows, describe it and ask "
		"again.\n"
		"- The line is whether the business's data or a marketplace changes, not "
		"whether the tool sounds harmless. A tool that syncs, pushes, imports or "
		"reprices is a write however it is named.\n"
		"- A tool may refuse on permissions. That is the system working; explain what "
		"the user would need, do not look for another route to the same effect.\n"
		"- Never invent figures. If you have not read a number with a tool, say so.\n"
		"- Do not guess a doctype name. If you are not certain one exists, list DocType "
		"filtered by name first — one call that tells you the real names beats three "
		"that come back 'DocType X not found'. The same goes for its fields: read them "
		"before you ask for them. And a Single doctype holds one record and cannot be "
		"listed; open it directly instead.\n\n"
		"Answer in plain prose, formatted as markdown — a table when you are reporting "
		"rows, bold for the figures that matter. Be concise and specific: cite the "
		"document names and numbers you actually retrieved."
	)

	parts = [prompt, CHART_PROMPT]
	if any(spec.get("name") == chat_artifacts.TOOL for spec in specs or []):
		parts.append(DOWNLOAD_PROMPT)

	if any(chat_tools.PACK_SEPARATOR in (spec.get("name") or "") for spec in specs or []):
		parts.append(PACK_PROMPT)

	extra = _tenant_context()
	if extra:
		parts.append(extra)
	return "\n\n".join(parts)


def _tenant_context():
	"""Deployment-specific context appended to the built-in prompt.

	The seam for a tenant app to say what only it knows — currency, date format,
	which marketplaces exist, what its role names mean. Declared in the tenant's
	own `hooks.py`:

	    chat_system_context = ["alaiy_os_globali.chat_context.system_context"]

	Each entry is a dotted path to a callable taking no arguments and returning a
	string (or None to contribute nothing — how an app opts out per user or per
	site). Appending rather than replacing is the whole point: the safety rules
	above are not a tenant's to drop, and several apps can each contribute a
	paragraph. `chat_system_prompt` in site_config is the escape hatch that
	*does* replace everything, this included — it is checked first, on purpose.
	"""
	parts = []
	for entry in frappe.get_hooks("chat_system_context") or []:
		try:
			value = frappe.get_attr(entry)()
		except Exception:
			# One tenant app's broken hook must not take the whole assistant
			# down — the prompt is still usable without its paragraph.
			frappe.log_error(title=f"chat_system_context hook failed: {entry}")
			continue
		if value:
			parts.append(str(value).strip())
	return "\n\n".join(parts)
