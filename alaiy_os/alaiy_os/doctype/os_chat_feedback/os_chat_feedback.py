import frappe
from frappe.model.document import Document


class OSChatFeedback(Document):
	def before_insert(self):
		# Never trust a client-supplied value here -- the whole point of this
		# doctype is knowing who actually said it. Overwritten unconditionally
		# (not just defaulted) so a direct REST insert can't spoof it either;
		# alaiy_os.api.feedback.submit_feedback also sets this explicitly, so
		# this is a backstop, not the only place it happens.
		self.user = frappe.session.user
