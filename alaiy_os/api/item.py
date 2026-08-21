import frappe

from alaiy_os.api.item_variants import get_variants

ITEM_FIELDS = [
	"name",
	"item_code",
	"item_name",
	"item_group",
	"brand",
	"description",
	"image",
	"disabled",
	"has_variants",
	"variant_of",
	"variant_based_on",
	"is_stock_item",
	"is_purchase_item",
	"is_sales_item",
	"is_fixed_asset",
	"has_batch_no",
	"has_serial_no",
	"stock_uom",
	"purchase_uom",
	"sales_uom",
	"standard_rate",
	"valuation_rate",
	"last_purchase_rate",
	"min_order_qty",
	"safety_stock",
	"lead_time_days",
	"shelf_life_in_days",
	"end_of_life",
	"warranty_period",
	"weight_per_unit",
	"weight_uom",
	"country_of_origin",
]

BIN_FIELDS = [
	"warehouse",
	"stock_uom",
	"actual_qty",
	"reserved_qty",
	"ordered_qty",
	"indented_qty",
	"projected_qty",
	"valuation_rate",
	"stock_value",
]

# Summed across the item's Bin rows for the card header. valuation_rate is
# left out on purpose: it is a per-warehouse average, and adding averages
# together produces a number that means nothing.
STOCK_TOTAL_FIELDS = [
	"actual_qty",
	"reserved_qty",
	"ordered_qty",
	"indented_qty",
	"projected_qty",
	"stock_value",
]

PRICE_FIELDS = [
	"name",
	"price_list",
	"price_list_rate",
	"currency",
	"uom",
	"buying",
	"selling",
	"customer",
	"supplier",
	"valid_from",
	"valid_upto",
]

ATTRIBUTE_FIELDS = ["idx", "attribute", "attribute_value"]

# The Item fields this app is allowed to write, each with the coercion its
# fieldtype needs. An allowlist, not a denylist, and read from here rather than
# from the request: the payload arrives from a browser, and Item carries fields
# a catalogue page has no business setting - the docname and its naming series,
# valuation figures ERPNext derives from stock movements, and the has_variants /
# variant_of pair that defines the variant tree. Anything absent below is
# refused by name rather than silently dropped, so a UI that grows a field
# without this list growing with it fails loudly in development.
WRITABLE_FIELDS = {
	"item_name": "data",
	"description": "text",
	"item_group": "link",
	"brand": "link",
	"stock_uom": "link",
	"purchase_uom": "link",
	"sales_uom": "link",
	"country_of_origin": "link",
	"standard_rate": "float",
	"min_order_qty": "float",
	"safety_stock": "float",
	"weight_per_unit": "float",
	"lead_time_days": "int",
	"shelf_life_in_days": "int",
	"warranty_period": "data",
	"end_of_life": "date",
	"disabled": "check",
	"is_stock_item": "check",
	"is_sales_item": "check",
	"is_purchase_item": "check",
}


@frappe.whitelist()
def get_item_detail(name):
	"""Everything the Item detail page renders, in one call: the item's own
	fields, its per-warehouse stock from Bin, its Item Price rows, and its
	place in the template/variant tree.

	One endpoint rather than four REST round-trips, and because Bin and Item
	Price are keyed by `item_code` rather than by the Item's docname - the
	two coincide under ERPNext's default Item naming but not under a naming
	series, so the child lookups have to be resolved from the item that was
	actually read, not from the name in the URL.
	"""
	frappe.has_permission("Item", "read", doc=name, throw=True)

	item = frappe.db.get_value("Item", name, ITEM_FIELDS, as_dict=True)
	if not item:
		frappe.throw(frappe._("Item {0} not found").format(name), frappe.DoesNotExistError)

	# Bin and Item Price are separate doctypes with their own permissions, so a
	# user who can read an Item may still not be allowed to see its stock or its
	# pricing. Reported as flags rather than quietly returning empty lists: an
	# empty stock table and "you cannot see the stock table" are different
	# statements, and showing the first for the second reads as "no stock".
	can_read_stock = bool(frappe.has_permission("Bin", "read"))
	can_read_prices = bool(frappe.has_permission("Item Price", "read"))

	# Reported so the page can render as plain values for a reader instead of
	# offering edit affordances that would 403 on save. It is not the check that
	# protects the write - update_item does that for itself, because a client
	# flag is a hint and not a permission.
	can_write_item = bool(frappe.has_permission("Item", "write", doc=name))

	bins = (
		frappe.get_all(
			"Bin",
			filters={"item_code": item.item_code},
			fields=BIN_FIELDS,
			order_by="warehouse asc",
		)
		if can_read_stock
		else []
	)

	prices = (
		frappe.get_all(
			"Item Price",
			filters={"item_code": item.item_code},
			fields=PRICE_FIELDS,
			order_by="price_list asc, valid_from desc",
		)
		if can_read_prices
		else []
	)

	return {
		"item": item,
		"template": _template(item),
		"stock": {"bins": bins, "totals": _stock_totals(bins)},
		"prices": prices,
		"attributes": frappe.get_all(
			"Item Variant Attribute",
			filters={"parent": item.name, "parenttype": "Item"},
			fields=ATTRIBUTE_FIELDS,
			order_by="idx asc",
		),
		"variants": get_variants(item.item_code) if item.has_variants else [],
		"can_read": {"stock": can_read_stock, "prices": can_read_prices},
		"can_write": {"item": can_write_item},
	}


def _stock_totals(bins):
	return {field: sum(float(b.get(field) or 0) for b in bins) for field in STOCK_TOTAL_FIELDS}


def _template(item):
	"""The variant's template, as {name, item_name}, so the detail page can
	link back to it by its display name instead of its bare code. None for an
	item that is not a variant."""
	if not item.variant_of:
		return None

	item_name = frappe.db.get_value("Item", item.variant_of, "item_name")
	return {"name": item.variant_of, "item_name": item_name}


@frappe.whitelist()
def update_item(name, values):
	"""Write a subset of one Item's fields, from the Item detail page.

	Through `frappe.get_doc(...).save()` rather than `db.set_value`: ERPNext
	hangs real validation off Item's controller - a UOM has to exist and have a
	conversion, an item group has to be a leaf, disabling a template cascades -
	and set_value skips all of it, leaving the catalogue in a state the desk
	form would have refused. The cost is that saving one field runs the whole
	document's validation, which is the correct trade for a catalogue write.

	Values are coerced by the fieldtype recorded in WRITABLE_FIELDS instead of
	being trusted as sent: everything arrives as a JSON string from a browser,
	so a Check would otherwise be stored as the text "true" and a Float as "12".
	"""
	frappe.has_permission("Item", "write", doc=name, throw=True)

	values = frappe.parse_json(values) if isinstance(values, str) else values
	if not isinstance(values, dict) or not values:
		frappe.throw(frappe._("No values to update."))

	refused = sorted(set(values) - set(WRITABLE_FIELDS))
	if refused:
		frappe.throw(frappe._("These fields cannot be edited here: {0}").format(", ".join(refused)))

	doc = frappe.get_doc("Item", name)
	for field, value in values.items():
		setattr(doc, field, _coerce(WRITABLE_FIELDS[field], value))

	doc.save()

	# The saved row rather than an ack: a controller can normalise what it was
	# handed (trimming, rounding, defaulting a UOM), so the page has to redraw
	# from what is now stored and not from what it just sent.
	return frappe.db.get_value("Item", doc.name, ITEM_FIELDS, as_dict=True)


def _coerce(kind, value):
	"""One JSON value, as the fieldtype behind it expects to be stored.

	Empty is the case worth spelling out. Frappe holds an unset Data, Link or
	Text as `""` and never as None, an unset Float or Int as 0, and an unset
	Date as None - so clearing a field means storing that doctype's own idea of
	empty, not passing None through and letting each fieldtype guess.
	"""
	if kind == "check":
		return 1 if frappe.utils.sbool(value) else 0

	if kind == "float":
		return frappe.utils.flt(value) if value not in (None, "") else 0

	if kind == "int":
		return frappe.utils.cint(value) if value not in (None, "") else 0

	if kind == "date":
		return frappe.utils.getdate(value) if value not in (None, "") else None

	if value is None:
		return ""

	return value.strip() if isinstance(value, str) else value
