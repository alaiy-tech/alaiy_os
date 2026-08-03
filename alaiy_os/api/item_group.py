import frappe


@frappe.whitelist()
def get_children(parent=None, is_root=False):
	"""One level of the Item Group tree at a time, for the /os/item-groups
	page's async-loaded tree (see interface/src/app/(main)/os/item-groups).

	Not reusing frappe.desk.treeview.get_children: that endpoint's response
	shape is desk-internal and not documented as stable, so this wraps
	frappe.get_all directly to keep the {name, is_group} contract ours to
	control. is_root=True (or no parent) means the tree's actual root
	row(s) - Item Group rows with no parent_item_group set.
	"""
	frappe.has_permission("Item Group", "read", throw=True)

	is_root = frappe.utils.sbool(is_root)
	filters = {"parent_item_group": ["in", ["", None]]} if (is_root or not parent) else {"parent_item_group": parent}

	return frappe.get_all(
		"Item Group",
		filters=filters,
		fields=["name", "is_group"],
		order_by="name asc",
	)
