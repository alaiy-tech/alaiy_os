"""REST surface for Ask Alaiy.

POST /api/method/alaiy_os.api.chat.create_session  -> {"session": "CHAT-..."}
POST /api/method/alaiy_os.api.chat.upload_attachment -> a staged file's chip (multipart)
POST /api/method/alaiy_os.api.chat.delete_attachment -> {"deleted": "..."}
POST /api/method/alaiy_os.api.chat.send_message    -> {"seq": n, "status": "Running"}
GET  /api/method/alaiy_os.api.chat.get_messages    -> messages after a cursor + status
GET  /api/method/alaiy_os.api.chat.list_sessions   -> the caller's sessions
POST /api/method/alaiy_os.api.chat.delete_session  -> {"deleted": "CHAT-..."}
GET  /api/method/alaiy_os.api.chat.list_tools      -> what the assistant can do
GET  /api/method/alaiy_os.api.chat.list_skills     -> the `/` command catalogue
GET  /api/method/alaiy_os.api.chat.list_mentions   -> the `@` picker's options

`send_message` returns as soon as the turn is queued; the client then polls
`get_messages` with the highest seq it has until status leaves "Running".

Progressive output is **opt-in**, per call: `get_messages(partial=1)` also returns
the message the assistant is still writing, flagged `partial: true`. Such a row is
re-sent, longer, on every poll, so a caller that asks for it must advance its
cursor past *complete* messages only and redraw a message it has already seen
rather than append it again.

The default is off, and has to be: the rule above inverts the one every existing
client follows. A poller that advances to the highest seq it saw would step past
the partial row and never be sent the finished message, leaving a truncated answer
on screen for good. So an unmodified consumer sees exactly what it always did —
nothing until the message is complete.

Isolation is Frappe's, not ours: both DocTypes grant the `All` role only
`if_owner`, so `check_permission` / the `owner` filter below is the whole story.
"""

import json

import frappe
from frappe.utils import cint
from frappe.utils.file_manager import save_file

# `mentions` is aliased because `send_message` already takes a parameter of that
# name, exactly as it does for `attachments` — a bare import would be shadowed
# inside the one function that needs it most.
from alaiy_os.chat import attachments
from alaiy_os.chat import mentions as chat_mentions
from alaiy_os.chat import runner, skills, tools


@frappe.whitelist()
def create_session(title=None, model=None):
	doc = frappe.get_doc(
		{
			"doctype": "OS Chat Session",
			"title": title,
			"model": model or runner.default_model(),
			"status": "Idle",
		}
	).insert()
	return {"session": doc.name, "title": doc.title, "model": doc.model, "status": doc.status}


@frappe.whitelist()
def list_sessions(limit=50):
	return frappe.get_all(
		"OS Chat Session",
		filters={"owner": frappe.session.user},
		fields=["name", "title", "model", "status", "last_activity", "modified"],
		order_by="modified desc",
		limit_page_length=int(limit),
	)


@frappe.whitelist()
def send_message(session, text=None, attachments=None, skill=None, screen=None, mentions=None):
	"""Queue one turn. `skill` is a slug from `list_skills`; `screen` is the caller's route.

	An unknown skill throws here rather than on the worker, so the picker gets a
	real error instead of a conversation that quietly answers the wrong thing.

	`mentions` is `[{kind, value}]` from `list_mentions` — the records the user
	picked with `@`. Each is re-resolved server-side, so only `kind` and `value`
	are read; anything else the client sends is rebuilt or discarded.
	"""
	# start_turn does its own check_permission("write") — the session's own
	# permission is the gate, since a chat can only reach what its owner can. It
	# also validates every attachment name against that session.
	seq = runner.start_turn(
		session, text, attachments=attachments, skill=skill, screen=screen, mentions=mentions
	)
	return {"seq": seq, "status": "Running"}


@frappe.whitelist()
def upload_attachment(session):
	"""Store one uploaded file against a chat and return its chip.

	Multipart, one file per request: each upload then gets its own progress and
	its own error, so a rejected PDF does not take a valid spreadsheet down with
	it. The file is parsed to text here rather than at send time — see
	`chat.attachments` for why.
	"""
	# First, and before touching the request body. `save_file` runs with
	# ignore_permissions set and checks nothing itself, so this is the entire
	# gate on writing a file into someone's chat.
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("write")

	uploaded = frappe.request.files.get("file")
	if not uploaded:
		frappe.throw(frappe._("No file uploaded."))

	content = uploaded.stream.read()
	file_name = uploaded.filename or "attachment"

	# Ours before Frappe's, so the user gets a message naming the real limit
	# rather than a MaxFileSizeReachedError. The extension allowlist is checked
	# server-side too: the <input accept> attribute is decoration, and the
	# browser-supplied content type is not evidence of anything.
	attachments.check_size(file_name, len(content))

	# Parse before storing. A throw here rolls back the transaction but *not*
	# the filesystem, so saving first would leave the bytes of every rejected
	# upload on disk with no File row pointing at them.
	text = attachments.extract(file_name, content)

	# Private, and attached to the session — which is what makes it readable by
	# exactly the people who can read the chat: File.has_permission delegates to
	# the attached document for private files, and OS Chat Session grants the
	# `All` role if_owner only.
	file_doc = save_file(file_name, content, "OS Chat Session", session, is_private=1)

	row = frappe.get_doc(
		{
			"doctype": "OS Chat Attachment",
			"session": session,
			"file": file_doc.name,
			"file_name": file_name,
			"file_size": len(content),
			"char_count": len(text),
			"extracted_text": text,
		}
	).insert()

	return {
		"name": row.name,
		"file_name": file_name,
		"file_url": file_doc.file_url,
		"file_size": len(content),
		"chars": len(text),
	}


@frappe.whitelist()
def delete_attachment(attachment):
	"""Drop a staged upload — the × on a chip before the message is sent.

	Deletes the stored file too. Nothing else references an unsent upload, so
	leaving it would just be litter on disk.
	"""
	row = frappe.get_doc("OS Chat Attachment", attachment)
	row.check_permission("delete")

	file_name = row.file
	row.delete()
	if file_name and frappe.db.exists("File", file_name):
		frappe.delete_doc("File", file_name, ignore_permissions=True, delete_permanently=True)

	return {"deleted": attachment}


@frappe.whitelist()
def get_messages(session, after=0, partial=0):
	"""Messages with seq > `after`, plus the session's current status.

	The poll endpoint. `after=0` fetches the whole conversation, which is also
	how the frontend loads a session picked from the history sidebar.

	`partial=1` additionally returns the message the assistant is mid-way through
	writing, flagged `partial: true` (see the module docstring, and `chat/runner.py`
	for how it comes to exist). Off by default because a client that has not been
	taught the cursor rule would skip past it and never see the finished message.
	"""
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("read")

	filters = {"session": session, "seq": (">", int(after))}
	if not cint(partial):
		filters["is_partial"] = 0

	rows = frappe.get_all(
		"OS Chat Message",
		filters=filters,
		fields=[
			"name",
			"seq",
			"role",
			"text",
			"blocks",
			"attachments",
			"mentions",
			"skill_used",
			"is_partial",
			"creation",
		],
		order_by="seq asc",
	)

	return {
		"session": doc.name,
		"title": doc.title,
		"status": doc.status,
		"error": doc.error,
		"messages": [_present(row) for row in rows],
	}


@frappe.whitelist()
def delete_session(session):
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("delete")
	doc.delete()
	return {"deleted": session}


@frappe.whitelist()
def list_tools():
	"""What the assistant can do *for this user* — for the UI and for support."""
	return [{"name": spec["name"], "description": spec["description"]} for spec in tools.tool_specs()]


@frappe.whitelist()
def list_skills():
	"""The `/` picker's catalogue: [{slug, label, description, icon}].

	Every enabled agent that opted into `chat_skill`. Invoke one by passing its
	slug to `send_message` — see `chat/skills.py` for what that does to the thread.
	"""
	return skills.catalogue()


@frappe.whitelist()
def list_mentions(q=None, kind=None):
	"""The `@` picker's options for `q`: {query, groups[]}.

	One call covers every kind this site has a source for, so a client draws the
	groups it is given and needs no knowledge of which are backed by a query.
	Safe to call on every keystroke — see `chat/mentions.py` for what decides
	whether a group's search actually runs.
	"""
	return chat_mentions.catalogue(q, kind)


def _present(row):
	"""One stored message in the shape the UI renders.

	`blocks` is the Anthropic wire format; the frontend should not have to know
	it. Text is already denormalised; tool traffic is reduced to what a human
	would want to see — which tool ran, with what arguments, and whether it
	failed. Tool *results* are deliberately not sent: they are raw JSON the
	model has already summarised in its reply, and can be megabytes.

	`partial` says the assistant is still writing this message: `text` is what has
	arrived so far and `tool_calls` is empty, because the blocks are not stored
	until the stream ends. See `chat/runner.py`.

	Attachments and mentions come from their own denormalised columns rather than
	being read back out of `blocks`, where they are indistinguishable from any
	other text block — and where the payload is the whole document, or the
	model's briefing, rather than a chip.
	"""
	blocks = json.loads(row.blocks or "[]")
	tool_calls = [
		{"id": b.get("id"), "name": b.get("name"), "input": b.get("input")}
		for b in blocks
		if b.get("type") == "tool_use"
	]
	tool_errors = [b.get("tool_use_id") for b in blocks if b.get("type") == "tool_result" and b.get("is_error")]

	return {
		"name": row.name,
		"seq": row.seq,
		"role": row.role,
		"text": row.text or "",
		"attachments": json.loads(row.attachments or "[]"),
		"mentions": json.loads(row.mentions or "[]"),
		"skill": row.skill_used,
		"tool_calls": tool_calls,
		"tool_errors": tool_errors,
		"partial": bool(row.is_partial),
		"creation": row.creation,
	}
