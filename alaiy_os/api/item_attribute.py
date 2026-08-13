import frappe
from frappe import _
from frappe.query_builder.functions import Count

ATTRIBUTE_FIELDS = [
	"name",
	"attribute_name",
	"disabled",
	"numeric_values",
	"from_range",
	"to_range",
	"increment",
]

# How many blocking item names to name outright in the delete error before
# falling back to "and N more".
BLOCKING_ITEMS_SHOWN = 3


@frappe.whitelist()
def get_attributes():
	"""Every Item Attribute with its values and a count of the items using it,
	for the /os/item-attributes page (see interface/src/app/(main)/os/item-attributes).

	One call rather than the obvious per-attribute fan-out: usage is an
	aggregate over `Item Variant Attribute`, so counting it from the browser
	would mean a request per attribute.

	Numeric attributes carry no values at all - ERPNext clears
	item_attribute_values whenever numeric_values is set - so they come back
	with an empty `values` list and are described by their range instead.
	"""
	frappe.has_permission("Item Attribute", "read", throw=True)

	attributes = frappe.get_all("Item Attribute", fields=ATTRIBUTE_FIELDS, order_by="attribute_name asc")
	if not attributes:
		return []

	names = [a.name for a in attributes]
	values_by_parent = _get_values(names)
	usage_by_attribute = _get_usage_counts(names)

	for attribute in attributes:
		attribute["values"] = values_by_parent.get(attribute.name, [])
		attribute["usage_count"] = usage_by_attribute.get(attribute.name, 0)

	return attributes


@frappe.whitelist()
def create_attribute(attribute_name, values=None):
	"""Create a non-numeric Item Attribute with an initial set of values.

	Numeric attributes aren't creatable here - they need from/to/increment and
	behave differently everywhere downstream, so the page shows the ones that
	already exist read-only rather than offering to make more.
	"""
	frappe.has_permission("Item Attribute", "create", throw=True)

	attribute_name = (attribute_name or "").strip()
	if not attribute_name:
		frappe.throw(_("Attribute name is required."))

	doc = frappe.new_doc("Item Attribute")
	doc.attribute_name = attribute_name

	taken_abbrs = set()
	for value in _clean_values(values):
		doc.append("item_attribute_values", {"attribute_value": value, "abbr": _make_abbr(value, taken_abbrs)})

	doc.insert()
	return doc.name


@frappe.whitelist()
def add_value(attribute, attribute_value):
	"""Append one value to an attribute and return the attribute's values."""
	doc = _get_editable_doc(attribute)

	attribute_value = (attribute_value or "").strip()
	if not attribute_value:
		frappe.throw(_("Value is required."))

	taken_abbrs = {row.abbr.lower() for row in doc.item_attribute_values if row.abbr}
	doc.append(
		"item_attribute_values",
		{"attribute_value": attribute_value, "abbr": _make_abbr(attribute_value, taken_abbrs)},
	)
	doc.save()

	return _get_values([doc.name]).get(doc.name, [])


@frappe.whitelist()
def rename_value(attribute, row_name, attribute_value):
	"""Rename one value in place, keeping its abbreviation.

	The row is edited by its child-row name rather than replaced, because
	that identity is exactly what ERPNext diffs on save to tell a rename from
	a delete-plus-add: it propagates the new text to every variant's
	`Item Variant Attribute` row. Rebuilding the table would instead read as
	the old value disappearing, which existing variants reject.
	"""
	doc = _get_editable_doc(attribute)

	attribute_value = (attribute_value or "").strip()
	if not attribute_value:
		frappe.throw(_("Value is required."))

	row = _find_row(doc, row_name)
	row.attribute_value = attribute_value
	doc.save()

	return _get_values([doc.name]).get(doc.name, [])


@frappe.whitelist()
def delete_value(attribute, row_name):
	"""Remove one value from an attribute and return the remaining values.

	ERPNext blocks this when a variant still carries the value, and says which
	item is holding it - that error is passed through untouched.
	"""
	doc = _get_editable_doc(attribute)

	row = _find_row(doc, row_name)
	doc.remove(row)
	doc.save()

	return _get_values([doc.name]).get(doc.name, [])


@frappe.whitelist()
def delete_attribute(attribute):
	"""Delete an Item Attribute, refusing while any item still uses it.

	Frappe's own link check would catch this too, but only with a generic
	"linked with Item Variant Attribute" message that names a child doctype
	the user never sees. Checking first lets the error name the actual items.
	"""
	frappe.has_permission("Item Attribute", "delete", throw=True)

	blocking = _get_items_using(attribute)
	if blocking:
		frappe.throw(
			_("{0} is in use by {1}. Remove it from those items first.").format(attribute, _describe(blocking))
		)

	frappe.delete_doc("Item Attribute", attribute)


def _get_values(attribute_names):
	"""Values of the given attributes, grouped by attribute name and kept in
	the order the child table stores them."""
	rows = frappe.get_all(
		"Item Attribute Value",
		filters={"parent": ["in", attribute_names], "parenttype": "Item Attribute"},
		fields=["name", "parent", "attribute_value", "abbr"],
		order_by="parent asc, idx asc",
	)

	values_by_parent = {}
	for row in rows:
		values_by_parent.setdefault(row.parent, []).append(
			{"name": row.name, "attribute_value": row.attribute_value, "abbr": row.abbr}
		)

	return values_by_parent


def _get_usage_counts(attribute_names):
	"""Number of distinct items referencing each attribute.

	Counts templates alongside their variants: a template item carries its own
	`Item Variant Attribute` row for every attribute it varies on, and it is
	just as much an item using the attribute.
	"""
	variant_attribute = frappe.qb.DocType("Item Variant Attribute")

	rows = (
		frappe.qb.from_(variant_attribute)
		.select(variant_attribute.attribute, Count(variant_attribute.parent).distinct().as_("item_count"))
		.where(variant_attribute.attribute.isin(attribute_names))
		.where(variant_attribute.parenttype == "Item")
		.groupby(variant_attribute.attribute)
	).run(as_dict=True)

	return {row.attribute: row.item_count for row in rows}


def _get_items_using(attribute):
	"""Names of the items referencing an attribute."""
	return frappe.get_all(
		"Item Variant Attribute",
		filters={"attribute": attribute, "parenttype": "Item"},
		pluck="parent",
		distinct=True,
		order_by="parent asc",
	)


def _describe(item_names):
	"""'Shirt, Trousers and 4 more' - the blocking items, without pasting a
	few hundred variant codes into an error message."""
	shown = item_names[:BLOCKING_ITEMS_SHOWN]
	remaining = len(item_names) - len(shown)
	listed = ", ".join(shown)

	return _("{0} and {1} more").format(listed, remaining) if remaining else listed


def _get_editable_doc(attribute):
	"""The attribute, loaded for a value edit and refusing numeric ones.

	ERPNext empties item_attribute_values on any save of a numeric attribute,
	so letting a value edit through here would silently discard whatever the
	table happened to hold.
	"""
	frappe.has_permission("Item Attribute", "write", throw=True)

	doc = frappe.get_doc("Item Attribute", attribute)
	if doc.numeric_values:
		frappe.throw(
			_("{0} is a numeric attribute - its values come from its range, not a list.").format(attribute)
		)

	return doc


def _find_row(doc, row_name):
	for row in doc.item_attribute_values:
		if row.name == row_name:
			return row

	frappe.throw(_("That value no longer exists on {0}.").format(doc.name), frappe.DoesNotExistError)


def _clean_values(values):
	"""Parse the values argument, trimmed, blanks dropped, first spelling of
	each duplicate kept.

	Case-insensitive de-duplication mirrors Item Attribute's own validation,
	which rejects the whole document when two values differ only in case -
	the page flags these before submitting, so anything still here is worth
	quietly collapsing rather than failing over.
	"""
	if isinstance(values, str):
		values = frappe.parse_json(values)

	cleaned = []
	seen = set()
	for value in values or []:
		value = (value or "").strip()
		if value and value.lower() not in seen:
			seen.add(value.lower())
			cleaned.append(value)

	return cleaned


def _make_abbr(value, taken_abbrs):
	"""An abbreviation for a value, unique within the attribute.

	`abbr` is mandatory on Item Attribute Value and ends up inside every
	variant's item code, but it's an implementation detail from the page's
	point of view - nothing in this UI asks the user for one, so it's derived
	here the way the desk form's own suggestion does: the value's leading
	alphanumerics, upper-cased.
	"""
	base = "".join(char for char in value if char.isalnum()).upper()[:3] or "VAL"

	abbr = base
	suffix = 1
	while abbr.lower() in taken_abbrs:
		suffix += 1
		abbr = f"{base}{suffix}"

	taken_abbrs.add(abbr.lower())
	return abbr
