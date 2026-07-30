from frappe.model.document import Document


class ItemSupplierAttribute(Document):
	"""Deprecated for new connector development — see this doctype's own
	"description" field. Still populated by the Cloudstore connector
	(Item.supplier_attributes) today, so it stays, but new connectors
	should not build against this shape."""
	pass
