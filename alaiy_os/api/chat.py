"""REST surface for Ask Alaiy.

POST /api/method/alaiy_os.api.chat.create_session  -> {"session": "CHAT-..."}
POST /api/method/alaiy_os.api.chat.upload_attachment -> a staged file's chip (multipart)
POST /api/method/alaiy_os.api.chat.delete_attachment -> {"deleted": "..."}
POST /api/method/alaiy_os.api.chat.send_message    -> {"seq": n, "status": "Running"}
GET  /api/method/alaiy_os.api.chat.get_messages    -> messages after a cursor + status
GET  /api/method/alaiy_os.api.chat.list_sessions   -> the caller's sessions
POST /api/method/alaiy_os.api.chat.delete_session  -> {"deleted": "CHAT-..."}
GET  /api/method/alaiy_os.api.chat.list_tools      -> what the assistant can do

`send_message` returns as soon as the turn is queued; the client then polls
`get_messages` with the highest seq it has until status leaves "Running".

Isolation is Frappe's, not ours: both DocTypes grant the `All` role only
`if_owner`, so `check_permission` / the `owner` filter below is the whole story.
"""

import json

import frappe
from frappe.utils.file_manager import save_file

from alaiy_os.chat import attachments, runner, tools


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
def send_message(session, text=None, attachments=None):
	# start_turn does its own check_permission("write") — the session's own
	# permission is the gate, since a chat can only reach what its owner can. It
	# also validates every attachment name against that session.
	seq = runner.start_turn(session, text, attachments=attachments)
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
def get_messages(session, after=0):
	"""Messages with seq > `after`, plus the session's current status.

	The poll endpoint. `after=0` fetches the whole conversation, which is also
	how the frontend loads a session picked from the history sidebar.
	"""
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("read")

	rows = frappe.get_all(
		"OS Chat Message",
		filters={"session": session, "seq": (">", int(after))},
		fields=["name", "seq", "role", "text", "blocks", "attachments", "creation"],
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


def _present(row):
	"""One stored message in the shape the UI renders.

	`blocks` is the Anthropic wire format; the frontend should not have to know
	it. Text is already denormalised; tool traffic is reduced to what a human
	would want to see — which tool ran, with what arguments, and whether it
	failed. Tool *results* are deliberately not sent: they are raw JSON the
	model has already summarised in its reply, and can be megabytes.

	Attachments come from their own denormalised column rather than being read
	back out of `blocks`, where they are indistinguishable from any other text
	block — and where the payload is the whole document rather than a chip.
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
		"tool_calls": tool_calls,
		"tool_errors": tool_errors,
		"creation": row.creation,
	}
