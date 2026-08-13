"""Shared machinery for the filter-aware KPI strips above the OS list pages.

Sales Orders and Purchase Orders both show four cards computed from exactly the
conditions the list query is running, plus a comparison against the equally-long
preceding window. The two differ only in doctype, which date field the range
filter applies to, and which field/statuses decide "overdue" - everything else
(the window substitution, the previous-period maths, the NULL-vs-0 handling) is
identical, and has to stay identical: these figures sit directly above the rows
they describe, and a divergence between the two pages is a bug nobody would
notice until the numbers were already wrong.
"""

import frappe
from frappe.utils import add_days, date_diff, getdate, nowdate


def summarise(
	doctype,
	filters,
	or_filters,
	from_date,
	to_date,
	date_field,
	overdue_field,
	settled_statuses,
):
	"""Count / total / average / overdue over the given window, each as a
	{current, previous} pair.

	`filters`/`or_filters` are the same conditions the page sends to its list
	query, so every figure describes exactly the rows in the table beneath it -
	including the status tab. That equivalence is the point: a KPI that
	silently applied its own docstatus rules would disagree with the row count
	right below it, and the user has no way to tell which one to believe. It
	also means the Cancelled tab reports cancelled value rather than nothing,
	which is the honest reading of "value of what I'm looking at".

	`from_date`/`to_date` are passed separately from the filters they already
	appear in, because the comparison figures need the window's length: the
	previous period is the equally-long stretch ending the day before it. With
	no date range picked there's nothing to compare against, so `previous`
	comes back None and the page drops the trend badge rather than inventing a
	baseline.
	"""
	filters = parse_list(filters)
	or_filters = parse_list(or_filters)

	current = _window_summary(
		doctype, filters, or_filters, from_date, to_date, date_field, overdue_field, settled_statuses
	)

	previous_from, previous_to = _previous_window(from_date, to_date)
	previous = (
		_window_summary(
			doctype,
			filters,
			or_filters,
			previous_from,
			previous_to,
			date_field,
			overdue_field,
			settled_statuses,
		)
		if previous_from
		else None
	)

	return {key: _pair(current, previous, key) for key in ("count", "total", "average", "past_due")}


def parse_list(value):
	if isinstance(value, str):
		value = frappe.parse_json(value)
	return list(value or [])


def _window_summary(doctype, filters, or_filters, from_date, to_date, date_field, overdue_field, settled_statuses):
	scoped = _with_window(filters, from_date, to_date, date_field)

	# Aggregates go through the dict form: Frappe rejects "count(name)" and
	# friends as raw strings in SELECT.
	totals = frappe.get_all(
		doctype,
		filters=scoped,
		or_filters=or_filters,
		fields=[{"COUNT": "name", "as": "count"}, {"SUM": "grand_total", "as": "total"}],
	)[0]

	# SUM over no rows is NULL, not 0.
	count = int(totals.count or 0)
	total = float(totals.total or 0)

	past_due = frappe.get_all(
		doctype,
		filters=[
			*scoped,
			[overdue_field, "<", nowdate()],
			["status", "not in", settled_statuses],
		],
		or_filters=or_filters,
		fields=[{"COUNT": "name", "as": "count"}],
	)[0]

	return {
		"count": count,
		"total": total,
		"average": total / count if count else 0.0,
		"past_due": int(past_due.count or 0),
	}


def _with_window(filters, from_date, to_date, date_field):
	"""`filters` with any `date_field` condition swapped for this window.

	The page's own date-range filter is already in `filters`; replacing it here
	is what lets the same filter set be re-run over the previous period without
	the two date conditions contradicting each other.

	With no window to substitute there is nothing to replace, and the caller's
	own date conditions are left alone - stripping them regardless would make a
	date-filtered request silently report on every order ever placed.
	"""
	if not (from_date or to_date):
		return list(filters)

	scoped = [f for f in filters if f[0] != date_field]

	if from_date:
		scoped.append([date_field, ">=", str(from_date)])
	if to_date:
		scoped.append([date_field, "<=", str(to_date)])

	return scoped


def _previous_window(from_date, to_date):
	"""The equally-long window ending the day before `from_date`."""
	if not (from_date and to_date):
		return None, None

	start, end = getdate(from_date), getdate(to_date)
	span = date_diff(end, start) + 1

	previous_to = add_days(start, -1)
	return add_days(previous_to, -(span - 1)), previous_to


def _pair(current, previous, key):
	return {"current": current[key], "previous": previous[key] if previous else None}
