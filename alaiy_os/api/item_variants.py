import frappe


@frappe.whitelist()
def get_variants(template_item_code):
	"""Child variants of a template Item (has_variants=1), each with its
	defining attribute values and standard selling rate - backs the
	variant accordion on the Products table row for that template.

	Pricing here is Item.standard_rate, a simplification: it doesn't
	consult Item Price across price lists, which would need a price list
	to resolve against.
	"""
	frappe.has_permission("Item", "read", throw=True)

	variants = frappe.get_all(
		"Item",
		filters={"variant_of": template_item_code},
		fields=["name", "item_code", "item_name", "image", "standard_rate", "disabled"],
		order_by="item_name asc",
	)
	if not variants:
		return []

	attribute_rows = frappe.get_all(
		"Item Variant Attribute",
		filters={"parent": ["in", [v.name for v in variants]]},
		fields=["parent", "attribute", "attribute_value"],
	)
	attributes_by_parent = {}
	for row in attribute_rows:
		attributes_by_parent.setdefault(row.parent, []).append(
			{"attribute": row.attribute, "attribute_value": row.attribute_value}
		)

	for v in variants:
		v["attributes"] = attributes_by_parent.get(v.name, [])

	return variants
