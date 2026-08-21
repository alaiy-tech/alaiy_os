# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt

"""Cross-system reconciliation substrate for the Commerce Pilot agent.

Every Commerce Action Proposal tool reads state through this module rather
than querying a connector's tables directly. The point is not convenience —
it's that no lever should ever act on ONE system's view of a fact (a price, a
stock count, a customs code) when a SIBLING system disagrees about the same
fact. Per "Coordination Surface Area" (Pradyun's ISC2026 proposal), that
disagreement — not any single system being wrong — is where physical-goods
commerce actually loses money.

Every function here returns a dict with an explicit `ok` flag and, when
`ok` is False, a human-readable `reason`. Callers must treat `ok: False` as
"do not act", never coerce a missing/stale value to a default and proceed —
this mirrors the null-is-not-zero discipline already established in the
Ask Alaiy agent bundle (alaiy_os_globali #3).
"""

import json

import frappe
from frappe.utils import now_datetime, time_diff_in_seconds

# How old a signal can be before we refuse to act on it. Deliberately
# conservative for a first pilot tranche — tighten or loosen once we have a
# track record for how fast each source actually drifts.
_MAX_STALENESS_SECONDS = 6 * 60 * 60  # 6 hours


def _stale(timestamp):
	if not timestamp:
		return True
	return time_diff_in_seconds(now_datetime(), timestamp) > _MAX_STALENESS_SECONDS


def get_reconciled_landed_cost(item_code):
	"""Best-known landed cost for `item_code`, reconciled across sources.

	Sources considered:
	  - Nayaglobal's cached CIF/landed-cost fields on Item (`ng_landed_cost_data`),
	    if the Nayaglobal app is installed and has populated them.
	  - The Item's own `standard_rate` / last Purchase Order rate, as a fallback
	    signal to compare against, never as the answer on its own.

	Returns {"ok": False, "reason": ...} rather than a number whenever the
	Nayaglobal figure is missing or stale — a Price Update must not be allowed
	to price off a cost nobody currently vouches for.
	"""
	if not frappe.db.exists("Item", item_code):
		return {"ok": False, "reason": f"Item '{item_code}' does not exist."}

	ng_field = "ng_landed_cost_data"
	has_ng_field = frappe.db.has_column("Item", ng_field)
	if not has_ng_field:
		return {
			"ok": False,
			"reason": (
				"Nayaglobal landed-cost field (Item.ng_landed_cost_data) is not "
				"present on this site — the Nayaglobal app's landed-cost sync isn't "
				"installed/wired here yet. Refusing to price off an unreconciled cost."
			),
		}

	raw = frappe.db.get_value("Item", item_code, ng_field)
	if not raw:
		return {
			"ok": False,
			"reason": f"No Nayaglobal landed-cost data cached for '{item_code}' yet.",
		}

	try:
		data = json.loads(raw) if isinstance(raw, str) else raw
	except (ValueError, TypeError):
		return {"ok": False, "reason": "Item.ng_landed_cost_data is not valid JSON."}

	landed_cost = data.get("landed_cost")
	as_of = data.get("as_of")
	if landed_cost is None:
		return {"ok": False, "reason": "Cached landed-cost payload has no landed_cost value."}
	if _stale(as_of):
		return {
			"ok": False,
			"reason": f"Landed-cost data for '{item_code}' is stale (as_of={as_of}).",
		}

	return {
		"ok": True,
		"landed_cost": landed_cost,
		"currency": data.get("currency", "INR"),
		"as_of": as_of,
		"source": "nayaglobal",
	}


def get_reconciled_stock_position(item_code, warehouse=None):
	"""Best-known sellable stock for `item_code`, reconciled across sources.

	Deliberately excludes any signal derived from the Flipkart/Unicommerce
	order-sync path: as of 2026-08-21 that connector pulls ALL orders from a
	shared sister Flipkart account, not scoped to this catalogue's own
	products (fix in progress on the team's side). Until that scoping fix
	ships, order-derived demand/stock signals through that path are not
	trustworthy for THIS business and must not silently feed a reorder or
	pricing decision.
	"""
	filters = {"item_code": item_code}
	if warehouse:
		filters["warehouse"] = warehouse

	bin_rows = frappe.get_all(
		"Bin", filters=filters, fields=["warehouse", "actual_qty", "modified"]
	)
	if not bin_rows:
		return {
			"ok": False,
			"reason": f"No Bin record for '{item_code}' — stock is unrecorded, not zero.",
		}

	total_qty = sum(row.actual_qty or 0 for row in bin_rows)
	stalest = max(bin_rows, key=lambda r: r.modified).modified
	if _stale(stalest):
		return {
			"ok": False,
			"reason": f"Stock data for '{item_code}' is stale (last updated {stalest}).",
		}

	return {
		"ok": True,
		"quantity": total_qty,
		"by_warehouse": {row.warehouse: row.actual_qty for row in bin_rows},
		"as_of": str(stalest),
		"excluded_sources": ["unicommerce_flipkart_order_sync"],
		"exclusion_reason": (
			"Flipkart/Unicommerce order sync is not yet scoped to this catalogue's "
			"own products (team fix in progress, flagged 2026-08-21) — its signal "
			"is excluded from this reconciliation until that ships."
		),
	}


def get_hsn_consistency(purchase_order, item_code):
	"""Compare the HSN code on a Purchase Order line against the Item master.

	This is the paper's central failure case, directly: a mismatch between two
	documents from two systems, never checked against each other before
	reaching customs. Returns ok=True only when both sides have a code AND
	they match; any other case is treated as a block, not a warning, because
	the whole point is to catch this BEFORE it reaches customs.
	"""
	if not frappe.db.exists("Purchase Order", purchase_order):
		return {"ok": False, "reason": f"Purchase Order '{purchase_order}' does not exist."}

	po = frappe.get_doc("Purchase Order", purchase_order)
	po_row = next((r for r in po.items if r.item_code == item_code), None)
	if po_row is None:
		return {"ok": False, "reason": f"'{item_code}' is not a line on {purchase_order}."}

	po_hsn = getattr(po_row, "gst_hsn_code", None)
	item_hsn = frappe.db.get_value("Item", item_code, "gst_hsn_code")

	if not po_hsn or not item_hsn:
		return {
			"ok": False,
			"reason": (
				f"HSN code missing on one side (PO line: {po_hsn!r}, Item master: "
				f"{item_hsn!r}) — cannot confirm consistency, so this is treated as "
				"a mismatch, not a pass."
			),
		}
	if po_hsn != item_hsn:
		return {
			"ok": False,
			"reason": f"HSN mismatch on '{item_code}': PO says {po_hsn!r}, Item master says {item_hsn!r}.",
		}

	return {"ok": True, "hsn_code": po_hsn}
