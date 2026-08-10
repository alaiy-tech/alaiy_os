import frappe
from frappe.model.document import Document


class OSUserPreference(Document):
	def validate(self):
		# (user, context_key) has to stay unique but isn't expressible as a
		# single-field DB unique constraint - enforced here instead. The
		# whitelisted set_preference API updates the existing row when one
		# exists rather than relying on this to reject a second insert, but
		# this stays as a safety net against any other write path.
		duplicate = frappe.db.exists(
			"OS User Preference",
			{"user": self.user, "context_key": self.context_key, "name": ["!=", self.name]},
		)
		if duplicate:
			frappe.throw(f"A preference for context '{self.context_key}' already exists for this user.")
