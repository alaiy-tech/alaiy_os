"""Follow-up questions offered under an answer.

Three chips below the assistant's reply — "and the month before?", "which SKUs
drove that?" — clickable, sent as the next message. The welcome screen already
proves the interaction works; this keeps it alive once the conversation starts,
which is exactly where a user runs out of ideas about what their data can answer.

## Where it runs, and why not where the issue asked

Generation is **one extra LLM call in the worker**, at the end of `run_turn`,
not a whitelisted `get_suggested_questions()` a client calls when the answer
lands. The rule in CHAT.md is that no LLM call happens in a web request, and it
holds here for the same reason it holds for a turn: a request that blocks on a
provider is a request that can time out on a provider. The client already polls;
suggestions ride that poll and cost the UI nothing to fetch.

## Why the API returns them at the top level

`get_messages` returns `suggestions` beside `status`, not on the message they
belong to — and that is load-bearing rather than convenient. A poller advances
its cursor past every complete message, so by the time these are written the
final assistant message is already behind the cursor and would never be sent
again. A per-message field would therefore be written and never read. A
top-level one is cursor-independent: every poll carries the current set,
including the last one.

## It fails silently, always

A suggestion is a nicety. It may never cost a user their answer, so every path
here — a provider that errors, a model that replies in prose, a JSON array of
numbers — logs and yields nothing. The turn has already been written and
committed by the time this runs; nothing it does can unwrite it.

The call is made with **no tools**. Suggestions are written from the transcript
that already exists, and a call that could read data would be a second, unaudited
route to it for the sake of decorating a reply.
"""

import json

import frappe

from alaiy_os.engine import llm

#: Three, not five. The chips sit between the answer and the composer, and a
#: wall of them stops reading as "you could also ask" and starts reading as a
#: menu the user has to work through before typing what they actually wanted.
MAX_SUGGESTIONS = 3

#: How much conversation the model is shown. Enough for "the month before that"
#: to have a referent, short enough that this stays the cheapest call in the turn.
HISTORY_MESSAGES = 6

#: Per line of the transcript. An answer with a large table in it is still an
#: answer, and its first 1500 characters say what it was about.
MAX_CHARS_PER_MESSAGE = 1_500

#: A suggestion is a chip, and a chip that wraps to three lines is a paragraph
#: wearing a border. Anything longer is dropped rather than truncated — half a
#: question is not a question.
MAX_SUGGESTION_CHARS = 90

#: The model writes questions *for the user to ask*, which is the whole trick:
#: asked to "suggest follow-ups" it drifts into offering to do things itself
#: ("I can break that down by channel if you like"), and a chip phrased that way
#: reads as a button that does something rather than a message that gets sent.
#:
#: The tool list is a fence, not a menu. A chip the assistant cannot act on is
#: worse than no chip — the user clicks it, waits for a turn, and is told no.
SUGGEST_PROMPT = (
	"You write the next questions a business user might ask their data assistant.\n"
	"\n"
	"You are given the tail of a conversation. Write exactly three short questions "
	"the user could sensibly ask next, in the user's own voice — what they would "
	"type, not what you would offer. Each one must:\n"
	"- follow naturally from what was just said, and go somewhere new: never "
	"restate a question already asked, or ask for something the last answer "
	"already gave;\n"
	"- be answerable from the same business data, using the tools listed below;\n"
	"- be self-contained enough to send on its own, and at most twelve words;\n"
	"- carry no greeting, no preamble and no explanation.\n"
	"\n"
	"Reply with a JSON array of three strings and nothing else. No prose, no code "
	"fence, no keys. If the conversation gives you nothing worth following up on, "
	"reply with an empty array."
)


def attach(doc):
	"""Generate this turn's suggestions and store them. Never raises.

	Called by `runner.run_turn` after the answer is committed and **before** the
	session goes Idle: a client stops polling on Idle, so anything written after
	that flip is written for nobody.
	"""
	try:
		if not frappe.conf.get("chat_suggestions", True):
			return
		last = _last_answer(doc.name)
		if not last:
			return
		items = generate(doc)
		if not items:
			return
		frappe.db.set_value(
			"OS Chat Message", last, "suggestions", json.dumps(items), update_modified=False
		)
		frappe.db.commit()
	except Exception:
		# Deliberately total. The turn is already written; a failure here is a
		# missing set of chips, and must never become a failed conversation.
		frappe.log_error(title=f"OS Chat Session {doc.name} suggestions failed")


def generate(doc):
	"""The follow-ups for the current state of `doc`, or None.

	Split out from `attach` so it can be exercised without writing anything —
	see `chat/smoke.py`.
	"""
	transcript = _transcript(doc.name)
	if not transcript:
		return None

	from alaiy_os.chat import runner, tools

	response = llm.complete(
		doc.model or runner.default_model(),
		SUGGEST_PROMPT + _tool_fence(tools),
		[{"role": "user", "content": [{"type": "text", "text": transcript}]}],
	)
	runner._record_usage(doc, response.get("usage") or {})
	return _parse(runner._text_of(response.get("content") or []))


def _last_answer(session):
	"""The newest settled assistant message with something in it, or None."""
	return frappe.db.get_value(
		"OS Chat Message",
		{"session": session, "role": "assistant", "is_partial": 0, "text": ("!=", "")},
		"name",
		order_by="seq desc",
	)


def _tool_fence(tools):
	"""The tool names, as one line appended to the prompt.

	Names only. Their descriptions are written for a model deciding whether to
	call one, which is a different question from what a user might ask, and they
	would be the largest thing in this request by far.
	"""
	try:
		names = sorted(spec["name"] for spec in tools.tool_specs())
	except Exception:
		names = []
	if not names:
		# No tools resolved — a site without FAC, or a tenant source that failed
		# closed. The assistant can still answer from what is in the history, so
		# the fence is dropped rather than the suggestions.
		return ""
	return "\n\nThe assistant's tools are: " + ", ".join(names) + "."


def _transcript(session):
	"""The tail of the conversation, as plain text. Empty if there is nothing to read.

	Reads the denormalised `text` column and never `blocks`: tool arguments,
	tool results and the contents of any attached document are not what a
	follow-up is written from, and they are the expensive part of the history.
	Filtering on a non-empty `text` also drops tool-result rows for free —
	`runner._loop` writes those with no text at all.
	"""
	rows = frappe.get_all(
		"OS Chat Message",
		filters={"session": session, "is_partial": 0, "text": ("!=", "")},
		fields=["role", "text", "mentions"],
		order_by="seq desc",
		limit_page_length=HISTORY_MESSAGES,
	)

	lines = []
	for row in reversed(rows):
		text = (row.text or "").strip()
		if not text:
			continue
		if len(text) > MAX_CHARS_PER_MESSAGE:
			text = text[:MAX_CHARS_PER_MESSAGE] + "…"
		speaker = "User" if row.role == "user" else "Assistant"
		# The records named with `@` are the difference between "how did that
		# brand do the month before?" being a usable chip and being unanswerable.
		# The labels are enough; the resolved dates behind them are the turn's
		# business, not this one's.
		named = _mention_labels(row.mentions)
		if named:
			text += f"\n(records named: {named})"
		lines.append(f"{speaker}: {text}")

	return "\n\n".join(lines)


def _mention_labels(raw):
	try:
		entries = json.loads(raw or "[]")
	except ValueError:
		return ""
	if not isinstance(entries, list):
		return ""
	labels = [str(e.get("label")) for e in entries if isinstance(e, dict) and e.get("label")]
	return ", ".join(labels)


def _parse(text):
	"""The model's reply as a clean list of chips, or None.

	Total by design: the model will sometimes answer in prose, sometimes wrap the
	array in a code fence, and occasionally return objects. Anything that is not
	a list of usable strings produces no chips rather than a broken one.
	"""
	body = (text or "").strip()
	if body.startswith("```"):
		# ```json … ``` — strip the fence line and whatever closes it.
		body = body.split("\n", 1)[-1]
		body = body.rsplit("```", 1)[0].strip()

	try:
		items = json.loads(body)
	except ValueError:
		return None
	if not isinstance(items, list):
		return None

	out, seen = [], set()
	for item in items:
		if not isinstance(item, str):
			continue
		one = item.strip()
		if not one or len(one) > MAX_SUGGESTION_CHARS or one.lower() in seen:
			continue
		seen.add(one.lower())
		out.append(one)
		if len(out) >= MAX_SUGGESTIONS:
			break

	return out or None
