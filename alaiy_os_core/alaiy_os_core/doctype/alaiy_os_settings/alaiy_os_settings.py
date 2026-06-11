import frappe
from frappe.model.document import Document


class AlaiyOSSettings(Document):
	# Single DocType — one record per ERPNext instance.
	# All connector credentials and feature flags live here.
	# Access via: frappe.get_single("Alaiy OS Settings")
	pass
