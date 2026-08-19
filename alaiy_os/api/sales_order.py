import frappe

ORDER_FIELDS = [
	"name",
	"customer",
	"customer_name",
	"company",
	"status",
	"docstatus",
	"transaction_date",
	"delivery_date",
	"po_no",
	"currency",
	"conversion_rate",
	"per_delivered",
	"per_billed",
	"amended_from",
	"sales_channel",
]

ITEM_FIELDS = [
	"name",
	"idx",
	"item_code",
	"item_name",
	"description",
	"uom",
	"qty",
	"delivered_qty",
	"rate",
	"amount",
	"delivery_date",
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

PAYMENT_SCHEDULE_FIELDS = [
	"idx",
	"payment_term",
	"description",
	"due_date",
	"invoice_portion",
	"payment_amount",
	"paid_amount",
	"outstanding",
]

DELIVERY_NOTE_FIELDS = ["name", "posting_date", "status", "docstatus", "is_return", "grand_total", "currency"]

INVOICE_FIELDS = [
	"name",
	"posting_date",
	"due_date",
	"status",
	"docstatus",
	"is_return",
	"grand_total",
	"outstanding_amount",
	"currency",
]


@frappe.whitelist()
def get_sales_order_detail(name):
	"""Everything the Sales Order detail page renders, in one call: the order
	header, its lines, its taxes, totals and payment schedule, and the Delivery
	Notes and Sales Invoices raised against it.

	One endpoint rather than the six REST round-trips the page would otherwise
	make, because the linked-document lookups are joins through child tables
	(`Delivery Note Item.against_sales_order`, `Sales Invoice Item.sales_order`)
	that the REST resource API cannot express.

	Mirrors alaiy_os.api.purchase_order.get_purchase_order_detail on the buy
	side; the two are deliberately shaped alike so the pages can read the same.
	"""
	frappe.has_permission("Sales Order", "read", doc=name, throw=True)

	order = frappe.db.get_value("Sales Order", name, ORDER_FIELDS + TOTALS_FIELDS, as_dict=True)
	if not order:
		frappe.throw(frappe._("Sales Order {0} not found").format(name), frappe.DoesNotExistError)

	items = frappe.get_all(
		"Sales Order Item",
		filters={"parent": name, "parenttype": "Sales Order"},
		fields=ITEM_FIELDS,
		order_by="idx asc",
	)
	_attach_billed_qty(items)

	taxes = frappe.get_all(
		"Sales Taxes and Charges",
		filters={"parent": name, "parenttype": "Sales Order"},
		fields=TAX_FIELDS,
		order_by="idx asc",
	)

	payment_schedule = frappe.get_all(
		"Payment Schedule",
		filters={"parent": name, "parenttype": "Sales Order"},
		fields=PAYMENT_SCHEDULE_FIELDS,
		order_by="due_date asc, idx asc",
	)

	return {
		"order": {field: order.get(field) for field in ORDER_FIELDS},
		"items": items,
		"taxes": taxes,
		"totals": {field: order.get(field) for field in TOTALS_FIELDS},
		"payment_schedule": payment_schedule,
		"delivery_notes": _linked_documents("Delivery Note", "against_sales_order", name, DELIVERY_NOTE_FIELDS),
		"invoices": _linked_documents("Sales Invoice", "sales_order", name, INVOICE_FIELDS),
	}


def _attach_billed_qty(items):
	"""Billed quantity per line, summed from the Sales Invoice lines that point
	back at it.

	Derived rather than read off the order, because Sales Order Item carries
	`billed_amt` (a currency) and no billed *quantity* - and a quantity is what
	belongs beside Delivered Qty in the same units as the ordered qty. Credit
	notes carry negative qty, so a credited line nets back down on its own.
	"""
	for item in items:
		item.billed_qty = 0.0

	by_row = {item.name: item for item in items}
	if not by_row:
		return

	rows = frappe.db.sql(
		"""
		select so_detail, coalesce(sum(qty), 0) as qty
		from `tabSales Invoice Item`
		where docstatus = 1 and so_detail in %(details)s
		group by so_detail
		""",
		{"details": list(by_row)},
		as_dict=True,
	)

	for row in rows:
		by_row[row.so_detail].billed_qty = float(row.qty or 0)


def _linked_documents(doctype, link_field, order_name, fields):
	"""Submitted-or-draft documents of `doctype` raised against this order.

	The link lives on the child table, so the parents are resolved first and
	then read back through a normal permission-checked query - `frappe.get_all`
	on a child doctype applies no permission match of its own (see `istable` in
	frappe/model/db_query.py), so the child query alone would leak the existence
	of documents the user cannot read.

	Cancelled documents are left out: a cancelled delivery note no longer
	accounts for anything on the order, and listing it next to the live ones
	invites adding its quantities up with them.
	"""
	if not frappe.has_permission(doctype, "read"):
		return []

	parents = frappe.get_all(
		f"{doctype} Item",
		filters={link_field: order_name, "docstatus": ["<", 2]},
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


@frappe.whitelist(methods=["POST"])
def submit_sales_order(name):
	"""Submit a draft order.

	Goes through the document rather than a bare docstatus write so ERPNext's
	own submit hooks still run - reserving stock, stamping the delivery and
	billing status, updating the customer's credit exposure. `doc.submit()`
	checks the submit permission itself; the explicit check above it is what
	turns a refusal into a clean 403 instead of a mid-save rollback.
	"""
	doc = frappe.get_doc("Sales Order", name)
	doc.check_permission("submit")

	if doc.docstatus != 0:
		frappe.throw(frappe._("Only a draft order can be submitted."))

	doc.submit()
	return {"name": doc.name, "status": doc.status, "docstatus": doc.docstatus}


@frappe.whitelist(methods=["POST"])
def cancel_sales_order(name):
	"""Cancel a submitted order.

	ERPNext refuses this itself when a submitted Delivery Note or Sales Invoice
	still links back (`Link Exists` on the cancel), which is the behaviour we
	want - those have to be cancelled first, and saying so is more useful than
	pre-empting it with a check here that would drift from ERPNext's own.
	"""
	doc = frappe.get_doc("Sales Order", name)
	doc.check_permission("cancel")

	if doc.docstatus != 1:
		frappe.throw(frappe._("Only a submitted order can be cancelled."))

	doc.cancel()
	return {"name": doc.name, "status": doc.status, "docstatus": doc.docstatus}


@frappe.whitelist(methods=["POST"])
def amend_sales_order(name):
	"""Open a fresh draft that supersedes a cancelled order.

	Returns the new draft's name for the caller to navigate to. `amended_from`
	is set explicitly rather than left to the desk form's client script, which
	is what normally stamps it - without it the new order is an unrelated
	document and the audit trail back to what it replaces is lost.
	"""
	doc = frappe.get_doc("Sales Order", name)
	doc.check_permission("read")
	frappe.has_permission("Sales Order", "create", throw=True)

	if doc.docstatus != 2:
		frappe.throw(frappe._("Only a cancelled order can be amended."))

	amended = frappe.copy_doc(doc)
	amended.amended_from = name
	amended.docstatus = 0
	amended.insert()

	return {"name": amended.name, "status": amended.status, "docstatus": amended.docstatus}


@frappe.whitelist(methods=["POST"])
def make_delivery_note_from_order(name):
	"""Map a submitted order into a draft Delivery Note and return its name.

	Left as a draft on purpose: quantities, warehouse and serial/batch picks
	are routinely adjusted between raising the note and shipping, so submitting
	it here would post stock the user has not looked at yet.
	"""
	from erpnext.selling.doctype.sales_order.sales_order import make_delivery_note

	frappe.has_permission("Sales Order", "read", doc=name, throw=True)
	frappe.has_permission("Delivery Note", "create", throw=True)

	target = make_delivery_note(name)
	target.insert()

	return {"name": target.name, "doctype": "Delivery Note"}


@frappe.whitelist(methods=["POST"])
def make_sales_invoice_from_order(name):
	"""Map a submitted order into a draft Sales Invoice and return its name.

	Draft for the same reason as the delivery note above - an invoice that
	posts to the ledger the moment a button is pressed is not recoverable
	without a credit note.
	"""
	from erpnext.selling.doctype.sales_order.sales_order import make_sales_invoice

	frappe.has_permission("Sales Order", "read", doc=name, throw=True)
	frappe.has_permission("Sales Invoice", "create", throw=True)

	target = make_sales_invoice(name)
	target.insert()

	return {"name": target.name, "doctype": "Sales Invoice"}
