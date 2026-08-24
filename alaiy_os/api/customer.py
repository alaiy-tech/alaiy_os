"""Customer rows for the Customers page table.

Each row is a Customer record plus the three figures the page shows beside it -
order count, booked value, and last order date - aggregated from Sales Order in
one pass rather than a query per row. Aggregates are computed in a subquery
grouped by customer so the join stays one row per customer; pulling the orders
themselves back would transfer every order on the site to count them.
"""

import frappe
from frappe.utils import cint, flt

# The table paginates client-side, so this is the size of one page load, not a
# page of rows. High enough that the ordinary site sends everything it has in
# one call; capped so a site with a large ledger can't be asked for all of it.
DEFAULT_LIMIT = 200
MAX_LIMIT = 1000


@frappe.whitelist()
def get_customers(limit=DEFAULT_LIMIT):
	"""Newest customers first, with their Sales Order aggregates.

	Only submitted orders (docstatus = 1) count towards `orders`, `total_spend`
	and `last_order_date`, matching what "active" means on the KPI strip above
	the table - a draft order is not yet a commitment either place.
	"""
	frappe.has_permission("Customer", "read", throw=True)

	limit = min(max(cint(limit) or DEFAULT_LIMIT, 1), MAX_LIMIT)

	rows = frappe.db.sql(
		"""
		select
			c.name,
			c.customer_name,
			c.customer_group,
			c.territory,
			c.customer_type,
			c.email_id,
			c.mobile_no,
			c.image,
			c.default_currency,
			c.disabled,
			c.creation,
			coalesce(o.orders, 0) as orders,
			coalesce(o.total_spend, 0) as total_spend,
			o.last_order_date
		from `tabCustomer` c
		left join (
			select
				so.customer,
				count(so.name) as orders,
				sum(so.grand_total) as total_spend,
				max(so.transaction_date) as last_order_date
			from `tabSales Order` so
			where so.docstatus = 1
			group by so.customer
		) o on o.customer = c.name
		order by c.creation desc
		limit %(limit)s
		""",
		{"limit": limit},
		as_dict=True,
	)

	return {
		"customers": [
			{
				"name": row.name,
				# Falls back to the docname because customer_name is only
				# required when naming is by name; a series-named site can
				# leave it empty and the table still needs something to show.
				"customer_name": row.customer_name or row.name,
				"customer_group": row.customer_group,
				"territory": row.territory,
				"customer_type": row.customer_type,
				"email_id": row.email_id,
				"mobile_no": row.mobile_no,
				"image": row.image,
				"currency": row.default_currency,
				"disabled": cint(row.disabled),
				"creation": str(row.creation),
				"orders": cint(row.orders),
				"total_spend": flt(row.total_spend),
				"last_order_date": str(row.last_order_date) if row.last_order_date else None,
			}
			for row in rows
		],
		"total": frappe.db.count("Customer"),
	}
