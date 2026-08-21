"""Register the Commerce Pilot agent and seed its first capital tranche.

NOTE on placement: core's own convention (see merge_agent_doctypes.py) is that
agent definitions live in separate installable agent apps, each self-registering
via their own install/migrate hook — not inside alaiy_os core. This patch
deliberately breaks that convention because Pradyun asked for this pilot to be
built and reviewed as a branch directly against alaiy_os_core rather than a new
standalone repo. Flagging this explicitly rather than silently picking a side:
worth revisiting whether this agent (and Commerce Capital Pool / Commerce
Action Proposal, which are generic enough to arguably belong in core either
way) should move to its own app once the pilot proves itself.

Idempotent — running this patch again on a site that already has the
"commerce_pilot" row updates it in place rather than duplicating it, mirroring
the agent-template's own sync_agent_registry() upsert pattern.
"""

import json

import frappe

AGENT_ID = "commerce_pilot"

TOOLS = [
	{
		"tool_id": "propose_price_update",
		"description": (
			"Propose a new selling price for an item. Computes reconciled landed "
			"cost and projected margin itself — never trust a margin figure you "
			"compute yourself, only the one this tool returns. Refuses to propose "
			"anything if landed cost can't be reconciled."
		),
		"handler": "alaiy_os.commerce.tools.propose_price_update",
		"parameters_schema": json.dumps({
			"type": "object",
			"properties": {
				"item_code": {"type": "string"},
				"proposed_price": {"type": "number"},
				"channel": {"type": "string"},
				"margin_floor_pct": {"type": "number"},
			},
			"required": ["item_code", "proposed_price"],
		}),
	},
	{
		"tool_id": "propose_reorder",
		"description": (
			"Propose a reorder quantity for an item against the active Commerce "
			"Capital Pool. Checks reconciled stock position and remaining pool "
			"balance before proposing; does not compute its own demand forecast "
			"in this first version — pass an explicit quantity."
		),
		"handler": "alaiy_os.commerce.tools.propose_reorder",
		"parameters_schema": json.dumps({
			"type": "object",
			"properties": {
				"item_code": {"type": "string"},
				"quantity": {"type": "number"},
				"capital_pool": {"type": "string"},
			},
			"required": ["item_code", "quantity"],
		}),
	},
]

SYSTEM_PROMPT = """You are the Commerce Pilot agent for Alaiy Commerce.

You propose pricing and reorder actions within a fixed policy: a 15-20%
minimum contribution margin floor after landed cost and channel fees, and a
fixed working-capital pool you must never overdraw. You never execute an
action yourself — every tool call produces a "Needs Review" proposal that a
human approves with one tap.

You must never compute a margin, a landed cost, or a stock position yourself.
Every tool you call returns those numbers already computed; if a tool
reports it could not reconcile a number (stale or missing data across
systems), do not substitute your own estimate — report the block reason back
to the human and stop.
"""


def execute():
	if not frappe.db.exists("DocType", "OS Agent Registry"):
		return  # site hasn't migrated in the doctype this patch depends on

	_seed_capital_pool()
	_register_agent()
	frappe.db.commit()


def _seed_capital_pool():
	if frappe.db.exists("Commerce Capital Pool", "commerce-pilot-tranche-1"):
		return
	frappe.get_doc({
		"doctype": "Commerce Capital Pool",
		"pool_id": "commerce-pilot-tranche-1",
		"is_active": 1,
		"total_capital": 10000,
		"deployed_capital": 0,
		"description": (
			"First tranche of the Alaiy Commerce 3.0 capital plan (₹25L target), "
			"deliberately staged conservatively. No further capital is added "
			"until this tranche has proven it generates a return."
		),
	}).insert(ignore_permissions=True)


def _register_agent():
	if frappe.db.exists("OS Agent Registry", AGENT_ID):
		doc = frappe.get_doc("OS Agent Registry", AGENT_ID)
	else:
		doc = frappe.new_doc("OS Agent Registry")
		doc.agent_id = AGENT_ID

	doc.agent_name = "Commerce Pilot"
	doc.is_enabled = 1
	doc.description = (
		"Proposes pricing and reorder actions for Alaiy Commerce, gated on a "
		"margin floor, a fixed capital pool, and cross-system reconciliation. "
		"Every action requires one-tap human approval before it executes."
	)
	doc.model = "claude-sonnet-5"
	doc.max_turns = 8
	doc.system_prompt = SYSTEM_PROMPT
	doc.output_format = "Text"
	doc.set("tools", [])
	for tool in TOOLS:
		doc.append("tools", tool)
	doc.save(ignore_permissions=True)
