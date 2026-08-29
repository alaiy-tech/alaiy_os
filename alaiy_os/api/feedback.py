"""REST surface for Ask Alaiy feedback -- see interface/docs/feedback-system.md.

POST /api/method/alaiy_os.api.feedback.submit_feedback -> {"name": "..."}

v1 is capture-only: one whitelisted call writes one `OS Chat Feedback` row
for later manual review. There is no read/list endpoint here -- review
happens through the doctype's own Desk list view, not a bespoke UI.
"""

import json

import frappe

SCREENS = ("Desk", "Interface Panel", "Interface Page")
SENTIMENTS = ("Up", "Down")


@frappe.whitelist()
def submit_feedback(session, message, sentiment, screen, agent_trail, feedback=None):
	"""One piece of feedback on one assistant reply: a thumb, plus a reason
	required only for a thumbs-down.

	`session` is gated exactly like every other chat call: the caller must be
	able to read it, via OS Chat Session's own if_owner permission -- see
	alaiy_os.api.chat's module docstring for why that check alone is the
	whole story. `message` is additionally checked to actually belong to
	`session`, so a caller can't attach feedback to someone else's message
	just because they own *a* session.

	`feedback` is required when `sentiment` is "Down" -- that's the entire
	point of asking for a reason on a bad reply -- and optional on "Up",
	where a bare thumb is already a complete, useful signal.

	`agent_trail` is a JSON string built client-side from the already-grouped
	turn (see feedback-system.md's "Which message" section for why this is a
	client-sent snapshot rather than re-derived server-side). Stored as-is;
	not reshaped, only checked for being valid JSON.
	"""
	doc = frappe.get_doc("OS Chat Session", session)
	doc.check_permission("read")

	if not frappe.db.exists("OS Chat Message", {"name": message, "session": session}):
		frappe.throw(frappe._("That message doesn't belong to this session."))

	if sentiment not in SENTIMENTS:
		frappe.throw(frappe._("Unknown sentiment: {0}").format(sentiment))

	if screen not in SCREENS:
		frappe.throw(frappe._("Unknown screen: {0}").format(screen))

	feedback = (feedback or "").strip()
	if sentiment == "Down" and not feedback:
		frappe.throw(frappe._("Tell us what was wrong before sending a thumbs-down."))

	try:
		json.loads(agent_trail or "")
	except (TypeError, ValueError):
		frappe.throw(frappe._("agent_trail must be valid JSON."))

	row = frappe.get_doc(
		{
			"doctype": "OS Chat Feedback",
			"user": frappe.session.user,
			"sentiment": sentiment,
			"session": session,
			"message": message,
			"feedback": feedback,
			"screen": screen,
			"agent_trail": agent_trail,
		}
	).insert()

	return {"name": row.name}
