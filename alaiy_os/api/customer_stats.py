"""KPI strip and trend chart behind the Customers page.

"Active" is read from Sales Order (docstatus = 1), the same booked/committed
definition item_stats uses for a unit "sold" - so a customer counts as active
when they placed an order in the window, not when someone opened their record.

The overview follows the window/previous-window shape every other KPI strip on
the OS uses (see list_summary.summarise): each figure is a {current, previous}
pair over two equally-long stretches, so the cards can draw a trend badge
without the page inventing a baseline.
"""

import calendar

import frappe
from frappe.utils import add_days, add_months, cint, flt, getdate, nowdate

PERIOD_DAYS = {"1D": 1, "1W": 7, "1M": 30, "1Y": 365}

# The trend chart deliberately takes no period, the same way the dashboard's
# get_sales_trend doesn't: acquisition read over a single day is one bucket and
# says nothing, and the KPI strip directly above it already answers "how is the
# chosen window doing". Twelve monthly buckets is the shape that reads.
TREND_MONTHS = 12


def _window(period):
	"""(start, previous_start) for `period`, where the current window is
	(start, today] and the previous is (previous_start, start]."""
	days = PERIOD_DAYS.get(period)
	if not days:
		frappe.throw(frappe._("Invalid period: {0}").format(period))

	start = add_days(nowdate(), -days)
	return start, add_days(start, -days)


def _pair(current, previous):
	return {"current": current, "previous": previous}


def _new_customers(start, end):
	"""Customers created in (start, end], both bounds taken at end of day.

	`creation` is a datetime while the window bounds are dates, so the lower
	bound has to be the *end* of `start` rather than its midnight - otherwise
	the boundary day lands in this window and in the preceding one, and the
	two figures the card compares both count it.
	"""
	row = frappe.db.sql(
		"""
		select count(name) as count
		from `tabCustomer`
		where creation > %(start)s and creation <= %(end)s
		""",
		{"start": f"{start} 23:59:59", "end": f"{end} 23:59:59"},
		as_dict=True,
	)
	return cint(row[0].count) if row else 0


def _total_customers(as_of):
	"""The live roster as it stood on `as_of`.

	`disabled` is a current flag with no history behind it, so a customer
	disabled today is excluded from both windows - the comparison measures
	roster growth, not retroactive deactivation.
	"""
	row = frappe.db.sql(
		"""
		select count(name) as count
		from `tabCustomer`
		where disabled = 0 and creation <= %(as_of)s
		""",
		{"as_of": f"{as_of} 23:59:59"},
		as_dict=True,
	)
	return cint(row[0].count) if row else 0


def _order_activity(start, end):
	"""Distinct ordering customers and their booked value in (start, end].

	transaction_date is a Date, so `> start` already excludes the boundary day
	and hands it to the preceding window - the same split _new_customers has to
	spell out against a datetime column.
	"""
	row = frappe.db.sql(
		"""
		select
			count(distinct so.customer) as customers,
			coalesce(sum(so.grand_total), 0) as revenue
		from `tabSales Order` so
		where so.docstatus = 1
		  and so.transaction_date > %(start)s
		  and so.transaction_date <= %(end)s
		""",
		{"start": start, "end": end},
		as_dict=True,
	)

	if not row:
		return 0, 0.0

	return cint(row[0].customers), flt(row[0].revenue)


@frappe.whitelist()
def get_customers_overview(period="1M"):
	"""The four Customers KPI cards, each as a {current, previous} pair."""
	frappe.has_permission("Customer", "read", throw=True)

	today = nowdate()
	start, previous_start = _window(period)

	current_active, current_revenue = _order_activity(start, today)
	previous_active, previous_revenue = _order_activity(previous_start, start)

	return {
		"period": period,
		"total_customers": _pair(_total_customers(today), _total_customers(start)),
		"new_customers": _pair(_new_customers(start, today), _new_customers(previous_start, start)),
		"active_customers": _pair(current_active, previous_active),
		"revenue_per_customer": _pair(
			current_revenue / current_active if current_active else 0.0,
			previous_revenue / previous_active if previous_active else 0.0,
		),
	}


@frappe.whitelist()
def get_customer_trend():
	"""New vs active customers per month over a rolling TREND_MONTHS.

	Each point's `period` is pre-labelled "Aug 25", the shape the chart's axis
	and tooltip parse. The current month is included partial rather than
	dropped - a month-to-date bar next to full months is the reading the axis
	labels already imply.
	"""
	frappe.has_permission("Customer", "read", throw=True)

	today = getdate(nowdate())
	first_of_this_month = today.replace(day=1)
	start = add_months(first_of_this_month, -(TREND_MONTHS - 1))

	new_rows = frappe.db.sql(
		"""
		select year(creation) as yr, month(creation) as mo, count(name) as count
		from `tabCustomer`
		where creation >= %(start)s
		group by year(creation), month(creation)
		""",
		{"start": start},
		as_dict=True,
	)

	active_rows = frappe.db.sql(
		"""
		select
			year(so.transaction_date) as yr,
			month(so.transaction_date) as mo,
			count(distinct so.customer) as count
		from `tabSales Order` so
		where so.docstatus = 1 and so.transaction_date >= %(start)s
		group by year(so.transaction_date), month(so.transaction_date)
		""",
		{"start": start},
		as_dict=True,
	)

	new_by_month = {(r.yr, r.mo): cint(r.count) for r in new_rows}
	active_by_month = {(r.yr, r.mo): cint(r.count) for r in active_rows}

	points = []
	for offset in range(TREND_MONTHS):
		month = add_months(start, offset)
		key = (month.year, month.month)
		points.append(
			{
				"period": f"{calendar.month_abbr[month.month]} {month.year % 100:02d}",
				"new_customers": new_by_month.get(key, 0),
				"active_customers": active_by_month.get(key, 0),
			}
		)

	return {"points": points}
