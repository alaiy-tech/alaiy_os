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
