import frappe
from frappe.model.document import Document


class OSChatSession(Document):
	def on_trash(self):
		# Messages are a Link child of the session in everything but name — they
		# are meaningless without it, and Frappe's link check would otherwise
		# refuse to delete a session that has any.
		frappe.db.delete("OS Chat Message", {"session": self.name})
		# Same for uploads staged but never sent. This has to happen in on_trash
		# rather than after_delete: delete_doc runs on_trash, *then* the link
		# check, then removes attached Files — a surviving row here would fail
		# that link check, and the uploads it points at would never be unlinked.
		frappe.db.delete("OS Chat Attachment", {"session": self.name})
