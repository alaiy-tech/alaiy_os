"""Declared tool permissions: one place that decides whether a user holds them.

`required_permissions` on an OS Agent Tool row is a declaration — what that tool
must be able to read (or write) for its handler to return real data rather than
an empty set. Two callers act on it, and they must never disagree:

	api/agent_settings.py	before enabling	 -> refuse the switch, show readiness
	engine/factory.py		before running	 -> refuse the run

Both are needed because of the shape of the failure. `frappe.get_list` returns
nothing for a user without permission rather than raising, so an
under-permissioned agent does not crash — it totals up nothing and reports
zeros, which reads as a quiet business day. Checking only at enable time moves
that silence rather than removing it: a role revoked afterwards, or a Run As
User changed afterwards, puts it straight back.

A tool that declares nothing is *undeclared*, not satisfied. There is nothing
here to check and nothing to refuse — the distinction is reported to the
operator (`declared` in the settings payload) instead, because an empty list
means "nobody has described this tool yet", and guessing what a handler reads
would be worse than saying so.
"""

import json

import frappe


def requirements(tool):
	"""Declared requirements for one OS Agent Tool row, as a list of dicts.

	Takes the row as a Document, a dict or a `frappe.get_all` row — the two
	callers reach the child table by different routes. Malformed JSON counts as
	no declaration: this feeds a gate and a settings screen, neither of which is
	improved by raising here. A row missing `doctype` is dropped for the same
	reason.
	"""
	raw = tool.get("required_permissions")
	if not raw:
		return []
	try:
		parsed = json.loads(raw) if isinstance(raw, str) else raw
	except (ValueError, TypeError):
		return []
	if not isinstance(parsed, list):
		return []
	return [r for r in parsed if isinstance(r, dict) and r.get("doctype")]


def granted(user, doctype, ptype="read"):
	"""Whether `user` holds `ptype` on `doctype`. Never raises.

	An unknown doctype — an app not installed, a typo in a manifest — is a
	requirement that cannot be satisfied, not a crash.
	"""
	try:
		return bool(frappe.has_permission(doctype=doctype, ptype=ptype or "read", user=user))
	except Exception:
		return False


def check_tool(user, tool):
	"""`[{doctype, ptype, granted}]` for one tool row, in declared order.

	Empty for an undeclared tool, which is why callers test the list's emptiness
	to tell "declares nothing" from "declares things it has".
	"""
	checked = []
	for requirement in requirements(tool):
		doctype = requirement["doctype"]
		ptype = requirement.get("ptype") or "read"
		checked.append({"doctype": doctype, "ptype": ptype, "granted": granted(user, doctype, ptype)})
	return checked


def describe(tool_id, doctype, ptype):
	"""The one phrasing for a missing requirement.

	Shared so that the sentence an operator reads in the settings screen and the
	one in a failed run's error are the same sentence.
	"""
	return f"{tool_id}: {ptype} on {doctype}"


def unmet(tools, user):
	"""What `user` is missing across `tools`, as a list of `describe()` strings."""
	missing = []
	for tool in tools:
		for requirement in check_tool(user, tool):
			if not requirement["granted"]:
				missing.append(describe(tool.get("tool_id"), requirement["doctype"], requirement["ptype"]))
	return missing
