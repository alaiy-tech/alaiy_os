# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt

"""Commerce Pilot agent tools.

Each `propose_*` function is a dotted-path handler registered on the
`commerce_pilot` OS Agent Registry row (see patches/register_commerce_pilot_agent.py).
Each does the reconciliation check itself, computes the numbers a reviewer
needs (never leaving arithmetic to the LLM, per the Ask Alaiy convention),
and writes a Commerce Action Proposal in "Needs Review" — it never calls a
marketplace or connector API directly.

Each `execute_*` function is called once, from Commerce Action Proposal's
`on_update`, only on the transition into "Approved". Per Alaiy OS's own
architectural rule, these write to LOCAL records and let the relevant
connector's existing scheduled sync carry the external write — except
execute_reorder, which calls the Nayaglobal connector's own registered sync
method (reusing the connector's surface, not reimplementing it).
"""

import json

import frappe

from alaiy_os.commerce import reconcile
from alaiy_os.connectors import call_dotted, get_connectors

DEFAULT_MARGIN_FLOOR_PCT = 15  # low end of the agreed 15-20% floor


# --------------------------------------------------------------------------
# Price Update
# --------------------------------------------------------------------------

def propose_price_update(item_code, proposed_price, channel=None, margin_floor_pct=None):
	"""Propose a new selling price for `item_code`, gated on reconciled landed cost.

	Refuses to create a proposal at all — not even a blocked one — if the
	reconciled cost can't be established; the reviewer needs a number to
	review, not a placeholder.
	"""
	margin_floor_pct = margin_floor_pct or DEFAULT_MARGIN_FLOOR_PCT
	cost = reconcile.get_reconciled_landed_cost(item_code)

	if not cost.get("ok"):
		frappe.throw(
			f"Cannot propose a price for '{item_code}': {cost.get('reason')}"
		)

	landed_cost = cost["landed_cost"]
	projected_margin_pct = round(100 * (proposed_price - landed_cost) / proposed_price, 2) if proposed_price else 0
	reconciliation_ok = projected_margin_pct >= margin_floor_pct
	block_reason = None if reconciliation_ok else (
		f"Projected margin {projected_margin_pct}% is below the {margin_floor_pct}% floor "
		f"(landed cost ₹{landed_cost}, proposed price ₹{proposed_price})."
	)

	current_price = frappe.db.get_value(
		"Item Price", {"item_code": item_code, "selling": 1}, "price_list_rate"
	)

	doc = frappe.get_doc({
		"doctype": "Commerce Action Proposal",
		"action_type": "Price Update",
		"item": item_code,
		"channel": channel,
		"status": "Needs Review" if reconciliation_ok else "Blocked",
		"current_value": current_price,
		"proposed_value": proposed_price,
		"margin_floor_pct": margin_floor_pct,
		"projected_margin_pct": projected_margin_pct,
		"reconciliation_ok": 1 if reconciliation_ok else 0,
		"block_reason": block_reason,
		"reconciliation_snapshot": json.dumps({"landed_cost": cost}),
	})
	doc.insert(ignore_permissions=True)
	return doc.name


def execute_price_update(proposal):
	"""Write the approved price locally; the channel's own sync pushes it out.

	Per Alaiy OS's own rule: agents don't call Shopify/Amazon APIs directly —
	they write the local Item Price row the connector already watches.
	"""
	price_list = frappe.db.get_value(
		"Item Price", {"item_code": proposal.item, "selling": 1}, "name"
	)
	if price_list:
		frappe.db.set_value("Item Price", price_list, "price_list_rate", proposal.proposed_value)
	else:
		frappe.get_doc({
			"doctype": "Item Price",
			"item_code": proposal.item,
			"selling": 1,
			"price_list_rate": proposal.proposed_value,
			"price_list": frappe.db.get_single_value("Selling Settings", "selling_price_list") or "Standard Selling",
		}).insert(ignore_permissions=True)


# --------------------------------------------------------------------------
# Reorder / PO
# --------------------------------------------------------------------------

def propose_reorder(item_code, quantity, capital_pool=None):
	"""Propose placing a reorder with Nayaglobal, gated on stock + capital.

	Deliberately does NOT compute a "days of cover" recommendation itself in
	this first slice — that needs a demand-velocity read that should reuse
	whatever Unicommerce-side R2/R7-equivalent logic the team builds, once the
	Flipkart/Unicommerce order-scoping fix (2026-08-21) has shipped and that
	demand signal is trustworthy. Until then this tool takes an explicit
	`quantity` from the caller rather than guessing one off unscoped data.
	"""
	stock = reconcile.get_reconciled_stock_position(item_code)
	cost = reconcile.get_reconciled_landed_cost(item_code)

	pool = None
	if capital_pool:
		pool = frappe.get_doc("Commerce Capital Pool", capital_pool)
	else:
		from alaiy_os.alaiy_os.doctype.commerce_capital_pool.commerce_capital_pool import get_active_pool
		pool = get_active_pool()

	reasons = []
	if not stock.get("ok"):
		reasons.append(f"stock: {stock.get('reason')}")
	if not cost.get("ok"):
		reasons.append(f"landed cost: {cost.get('reason')}")

	amount_requested = None
	if cost.get("ok"):
		amount_requested = round(cost["landed_cost"] * quantity, 2)
		if pool is None:
			reasons.append("no active Commerce Capital Pool to deploy against.")
		elif amount_requested > (pool.available_capital or 0):
			reasons.append(
				f"requested ₹{amount_requested} exceeds pool '{pool.pool_id}' available "
				f"balance of ₹{pool.available_capital}."
			)

	reconciliation_ok = not reasons
	block_reason = "; ".join(reasons) if reasons else None

	doc = frappe.get_doc({
		"doctype": "Commerce Action Proposal",
		"action_type": "Reorder PO",
		"item": item_code,
		"channel": "nayaglobal",
		"status": "Needs Review" if reconciliation_ok else "Blocked",
		"proposed_value": quantity,
		"capital_pool": pool.name if pool else None,
		"amount_requested": amount_requested,
		"reconciliation_ok": 1 if reconciliation_ok else 0,
		"block_reason": block_reason,
		"reconciliation_snapshot": json.dumps({"stock": stock, "landed_cost": cost}),
	})
	doc.insert(ignore_permissions=True)
	return doc.name


def execute_reorder(proposal):
	"""Place the order via Nayaglobal's own connector — reuse, not reimplement.

	Resolved by label against OS Connector Registry rather than importing the
	Nayaglobal app's Python module directly, matching alaiy_os/connectors.py's
	existing connector-agnostic pattern. Left explicitly unwired (raises) if
	the connector hasn't registered a matching sync slot yet — a "flagged not
	guessed" placeholder rather than inventing a call signature we haven't
	confirmed against the real Nayaglobal connector app.
	"""
	rows = get_connectors(connector_type="sourcing", only_enabled=True)
	nayaglobal = next((r for r in rows if r.connector_id == "nayaglobal"), None)
	if nayaglobal is None:
		raise frappe.ValidationError(
			"Nayaglobal connector is not enabled/registered — cannot place the reorder. "
			"This tool deliberately does not call the Nayaglobal API directly; it needs "
			"the connector's own place-order sync slot wired into OS Connector Registry."
		)

	place_order_method = nayaglobal.get("sync_items_method")  # placeholder slot; see note above
	if not place_order_method:
		raise frappe.ValidationError(
			"Nayaglobal connector has no place-order method registered in "
			"OS Connector Registry yet — nothing to call. Needs the Nayaglobal "
			"connector team to register the real place_order dotted path here "
			"before this executor can run for real."
		)

	call_dotted(place_order_method, item_code=proposal.item, quantity=proposal.proposed_value)


# --------------------------------------------------------------------------
# Ad Spend / Listing Edit — proposal shape defined, execution intentionally
# not yet wired (flagged, not guessed): each needs a connector-specific call
# this pass didn't confirm a real signature for.
# --------------------------------------------------------------------------

def execute_ad_spend(proposal):
	raise frappe.ValidationError(
		"Ad Spend execution is not wired yet — no confirmed Amazon/Flipkart Ads "
		"API call in this codebase to reuse. Proposal creation/approval flow is "
		"in place; connect the real ads connector before enabling this lever."
	)


def execute_listing_edit(proposal):
	raise frappe.ValidationError(
		"Listing Edit execution is not wired yet in the Commerce Pilot agent — "
		"reuse alaiy_os_agent_shopify_listing / alaiy_os_agent_amazon_listing's "
		"existing enriched-listing push pattern rather than reimplementing it here."
	)
