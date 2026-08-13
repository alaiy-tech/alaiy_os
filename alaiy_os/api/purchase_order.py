import frappe

ORDER_FIELDS = [
	"name",
	"supplier",
	"supplier_name",
	"company",
	"status",
	"docstatus",
	"transaction_date",
	"schedule_date",
	"currency",
	"conversion_rate",
	"per_received",
	"per_billed",
]

ITEM_FIELDS = [
	"name",
	"idx",
	"item_code",
	"item_name",
	"uom",
	"qty",
	"received_qty",
	"rate",
	"amount",
	"schedule_date",
	"warehouse",
]

TAX_FIELDS = ["idx", "charge_type", "account_head", "description", "rate", "tax_amount", "total"]

TOTALS_FIELDS = [
	"total_qty",
	"total",
	"total_taxes_and_charges",
	"discount_amount",
	"apply_discount_on",
	"grand_total",
	"rounded_total",
	"disable_rounded_total",
]

RECEIPT_FIELDS = ["name", "posting_date", "status", "docstatus", "is_return", "grand_total", "currency"]

INVOICE_FIELDS = [
	"name",
	"posting_date",
	"due_date",
	"bill_no",
	"status",
	"docstatus",
	"is_return",
	"grand_total",
	"outstanding_amount",
	"currency",
]


@frappe.whitelist()
def get_purchase_order_detail(name):
	"""Everything the Purchase Order detail page renders, in one call: the
	order header, its lines, its taxes and totals, and the Purchase Receipts
	and Purchase Invoices raised against it.

	One endpoint rather than the five REST round-trips the page would
	otherwise make, because the linked-document lookups are joins through
	child tables (`Purchase Receipt Item.purchase_order`,
	`Purchase Invoice Item.purchase_order`) that the REST resource API cannot
	express.
	"""
	frappe.has_permission("Purchase Order", "read", doc=name, throw=True)

	order = frappe.db.get_value("Purchase Order", name, ORDER_FIELDS + TOTALS_FIELDS, as_dict=True)
	if not order:
		frappe.throw(frappe._("Purchase Order {0} not found").format(name), frappe.DoesNotExistError)

	items = frappe.get_all(
		"Purchase Order Item",
		filters={"parent": name, "parenttype": "Purchase Order"},
		fields=ITEM_FIELDS,
		order_by="idx asc",
	)
	_attach_billed_qty(items)

	taxes = frappe.get_all(
		"Purchase Taxes and Charges",
		filters={"parent": name, "parenttype": "Purchase Order"},
		fields=TAX_FIELDS,
		order_by="idx asc",
	)

	return {
		"order": {field: order.get(field) for field in ORDER_FIELDS},
		"items": items,
		"taxes": taxes,
		"totals": {field: order.get(field) for field in TOTALS_FIELDS},
		"receipts": _linked_documents("Purchase Receipt", name, RECEIPT_FIELDS),
		"invoices": _linked_documents("Purchase Invoice", name, INVOICE_FIELDS),
	}


def _attach_billed_qty(items):
	"""Billed quantity per line, summed from the Purchase Invoice lines that
	point back at it.

	Derived rather than read off the order, because Purchase Order Item carries
	`billed_amt` (a currency) and no billed *quantity* - and a quantity is what
	belongs beside Received Qty in the same units as the ordered qty. Return
	invoices carry negative qty, so a credited line nets back down on its own.
	"""
	for item in items:
		item.billed_qty = 0.0

	by_row = {item.name: item for item in items}
	if not by_row:
		return

	rows = frappe.db.sql(
		"""
		select po_detail, coalesce(sum(qty), 0) as qty
		from `tabPurchase Invoice Item`
		where docstatus = 1 and po_detail in %(details)s
		group by po_detail
		""",
		{"details": list(by_row)},
		as_dict=True,
	)

	for row in rows:
		by_row[row.po_detail].billed_qty = float(row.qty or 0)


def _linked_documents(doctype, order_name, fields):
	"""Submitted-or-draft documents of `doctype` raised against this order.

	The link lives on the child table, so the parents are resolved first and
	then read back through a normal permission-checked query - `frappe.get_all`
	on a child doctype applies no permission match of its own (see
	`istable` in frappe/model/db_query.py), so the child query alone would
	leak the existence of documents the user cannot read.

	Cancelled documents are left out: a cancelled receipt no longer accounts
	for anything on the order, and listing it next to the live ones invites
	adding its quantities up with them.
	"""
	if not frappe.has_permission(doctype, "read"):
		return []

	parents = frappe.get_all(
		f"{doctype} Item",
		filters={"purchase_order": order_name, "docstatus": ["<", 2]},
		pluck="parent",
		distinct=True,
	)
	if not parents:
		return []

	return frappe.get_all(
		doctype,
		filters={"name": ["in", parents], "docstatus": ["<", 2]},
		fields=fields,
		order_by="posting_date desc, name desc",
	)
