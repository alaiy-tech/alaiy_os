from frappe.model.document import Document


class OSChatAttachment(Document):
	"""A file uploaded to a chat but not yet sent.

	Purely a staging row: `runner.start_turn` inlines `extracted_text` into the
	user message's blocks and deletes the row. The File it points at is attached
	to the *session*, not to this row, so it outlives the staging row on purpose
	— the sent message's chip still links to it — and is cleaned up by Frappe's
	own attachment cascade when the session is deleted.

	The one path that does delete the File is `api.chat.delete_attachment`, i.e.
	the user removing a chip before sending: that upload is never referenced by
	anything and would otherwise sit on disk forever.
	"""

	pass
