"""Settings surface for agents: enable/disable, and what each tool needs.

Two questions this answers, which the Desk list view cannot:

  1. Which agents exist, which are on, and who does each run as.
  2. For every tool, what permission does it need, and does the agent's
     Run As User actually have it right now.

(2) is why enabling is gated here rather than being a bare checkbox. An agent
whose user cannot read Sales Invoice does not fail loudly — it quietly reports
zeros, which is worse. `frappe.get_list` returns an empty set for a user without
permission, so an under-permissioned agent looks like a quiet business day.
"""

import json

import frappe

# Agents run as Administrator when no user is set. Named rather than implied so
# the UI can say so out loud.
ADMINISTRATOR = "Administrator"


def _tool_permissions(tool):
	"""Declared requirements for one tool row, as a list of dicts."""
	raw = tool.get("required_permissions")
	if not raw:
		return []
	try:
		parsed = json.loads(raw) if isinstance(raw, str) else raw
	except (ValueError, TypeError):
		return []
	return parsed if isinstance(parsed, list) else []


def _check(user, doctype, ptype):
	"""Whether `user` holds `ptype` on `doctype`. Never raises."""
	try:
		return bool(frappe.has_permission(doctype=doctype, ptype=ptype, user=user))
	except Exception:
		# An unknown doctype (app not installed, typo in a manifest) is a
		# requirement that cannot be satisfied, not a crash.
		return False


@frappe.whitelist()
def list_agents():
	"""Every registered agent with its enable state and permission readiness."""
	if not frappe.has_permission("OS Agent Registry", "read"):
		frappe.throw("Not permitted.", frappe.PermissionError)

	agents = []
	for row in frappe.get_all(
		"OS Agent Registry",
		fields=["name", "agent_id", "agent_name", "description", "icon",
				"is_enabled", "run_as_user", "model", "page"],
		order_by="agent_name",
	):
		user = row.run_as_user or ADMINISTRATOR
		tools = frappe.get_all(
			"OS Agent Tool",
			filters={"parent": row.name, "parenttype": "OS Agent Registry"},
			fields=["tool_id", "description", "connector", "required_permissions"],
			order_by="idx",
		)

		tool_views, unmet = [], []
		for tool in tools:
			requirements = []
			for requirement in _tool_permissions(tool):
				doctype = requirement.get("doctype")
				ptype = requirement.get("ptype", "read")
				granted = _check(user, doctype, ptype)
				requirements.append({"doctype": doctype, "ptype": ptype, "granted": granted})
				if not granted:
					unmet.append(f"{tool.tool_id}: {ptype} on {doctype}")

			tool_views.append({
				"tool_id": tool.tool_id,
				"connector": tool.connector,
				# A tool that declares nothing is not "satisfied", it is
				# undeclared — the UI should be able to tell those apart.
				"declared": bool(requirements),
				"permissions": requirements,
				"writes": any(r["ptype"] != "read" for r in requirements),
			})

		agents.append({
			"agent_id": row.agent_id,
			"agent_name": row.agent_name,
			"description": row.description,
			"icon": row.icon,
			"model": row.model,
			"page": row.page,
			"is_enabled": bool(row.is_enabled),
			"run_as_user": user,
			"runs_as_administrator": not row.run_as_user,
			"tools": tool_views,
			"permissions_satisfied": not unmet,
			"unmet_permissions": unmet,
			# Read-only agents are safe to leave on; anything that writes is a
			# deliberate decision, so surface it at agent level too.
			"writes": any(t["writes"] for t in tool_views),
		})

	return agents


@frappe.whitelist()
def set_agent_enabled(agent, enabled, force=False):
	"""
	Turn an agent on or off.

	Enabling is refused when the agent's Run As User is missing a permission its
	tools declare, because the resulting runs would silently report nothing
	rather than fail. `force` overrides that for a deliberate operator decision
	— disabling is never gated.
	"""
	if not frappe.has_permission("OS Agent Registry", "write"):
		frappe.throw("Not permitted.", frappe.PermissionError)

	enabled = frappe.parse_json(enabled) if isinstance(enabled, str) else enabled
	enabled = bool(enabled)
	force = bool(frappe.parse_json(force) if isinstance(force, str) else force)

	if enabled and not force:
		state = next((a for a in list_agents() if a["agent_id"] == agent), None)
		if state and not state["permissions_satisfied"]:
			frappe.throw(
				"{0} cannot be enabled: {1} is missing {2}. "
				"Grant the permission, change Run As User, or enable with force.".format(
					agent, state["run_as_user"], "; ".join(state["unmet_permissions"])
				),
				title="Missing permissions",
			)

	frappe.db.set_value("OS Agent Registry", agent, "is_enabled", 1 if enabled else 0)
	frappe.db.commit()
	return {"agent": agent, "is_enabled": enabled}
