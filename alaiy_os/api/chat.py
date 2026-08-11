"""REST surface for Ask Alaiy.

POST /api/method/alaiy_os.api.chat.create_session  -> {"session": "CHAT-..."}
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

from alaiy_os.chat import runner, tools


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
def send_message(session, text):
	# start_turn does its own check_permission("write") — the session's own
	# permission is the gate, since a chat can only reach what its owner can.
	seq = runner.start_turn(session, text)
	return {"seq": seq, "status": "Running"}


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
		fields=["name", "seq", "role", "text", "blocks", "creation"],
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
		"tool_calls": tool_calls,
		"tool_errors": tool_errors,
		"creation": row.creation,
	}
