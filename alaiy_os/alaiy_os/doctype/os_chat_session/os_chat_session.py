import frappe
from frappe.model.document import Document


class OSChatSession(Document):
	def on_trash(self):
		# Messages are a Link child of the session in everything but name — they
		# are meaningless without it, and Frappe's link check would otherwise
		# refuse to delete a session that has any.
		frappe.db.delete("OS Chat Message", {"session": self.name})
