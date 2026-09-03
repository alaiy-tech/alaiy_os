"""Settings surface for agents: enable/disable, and what each tool needs.

Two questions this answers, which the Desk list view cannot:

  1. Which agents exist, which are on, and who does each run as.
  2. For every tool, what permission does it need, and does the agent's
     Run As User actually have it right now.

(2) is why enabling is gated here rather than being a bare checkbox. An agent
whose user cannot read Sales Invoice does not fail loudly — it quietly reports
zeros, which is worse. `frappe.get_list` returns an empty set for a user without
permission, so an under-permissioned agent looks like a quiet business day.

The gate here is design-time. `engine/factory.py` re-checks the same
declarations against the same user before every run, through the shared
`engine/permissions.py` — a role revoked after an agent was switched on would
otherwise bring the zeros back with the switch still on.
"""

import frappe

from alaiy_os.engine import permissions

# Agents run as Administrator when no user is set. Named rather than implied so
# the UI can say so out loud.
ADMINISTRATOR = "Administrator"


@frappe.whitelist()
def list_agents():
	"""Every registered agent with its enable state and permission readiness."""
	if not frappe.has_permission("OS Agent Registry", "read"):
		frappe.throw("Not permitted.", frappe.PermissionError)

	agents = []
	for row in frappe.get_all(
		"OS Agent Registry",
		fields=["name", "agent_id", "agent_name", "description", "icon",
				"is_enabled", "run_as_user", "model", "page", "source_app"],
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
			requirements = permissions.check_tool(user, tool)
			unmet.extend(
				permissions.describe(tool.tool_id, requirement["doctype"], requirement["ptype"])
				for requirement in requirements
				if not requirement["granted"]
			)

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
			# Which app registered this row, or None for one written by hand in
			# the Desk. Two things read it: the card, to say where an agent came
			# from, and an operator about to edit a prompt here — because an app
			# that owns a row rewrites it on the next reconcile, so a hand-edit
			# to an owned agent is work that will disappear without warning.
			"source_app": row.source_app or None,
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


@frappe.whitelist()
def set_agent_run_as_user(agent, user=None):
	"""
	Set — or clear — the service user an agent's runs adopt.

	Clearing it means Administrator, which reads the whole site. That is the
	field's default rather than a neutral blank, which is why the settings
	payload reports `runs_as_administrator` as a fact of its own: an agent
	nobody has assigned a user to is not unconfigured, it is site-wide.

	Returns the agent's recomputed settings row, because changing the user
	rewrites every permission answer on it — the caller should render what comes
	back rather than patching its own copy.

	An agent that is already on stays on, even when the new user cannot satisfy
	its tools. Switching it off here would be a second surprise for an operator
	who asked for one thing, and it is no longer needed to stay safe: since
	`engine/factory.py` re-checks the declarations, such a run now fails loudly
	instead of reporting zeros. The row comes back saying both — enabled, and
	missing permissions.
	"""
	if not frappe.has_permission("OS Agent Registry", "write"):
		frappe.throw("Not permitted.", frappe.PermissionError)

	if not frappe.db.exists("OS Agent Registry", agent):
		frappe.throw(f"There is no agent {agent}.")

	user = (user or "").strip()
	if user:
		# Checked here rather than left to the Link field's own validation: a
		# disabled or Guest user is accepted by the link and then silently reads
		# nothing, which is the failure this whole module exists to prevent.
		if user == "Guest":
			frappe.throw("An agent cannot run as Guest.")
		state = frappe.db.get_value("User", user, ["enabled"], as_dict=True)
		if not state:
			frappe.throw(f"There is no user {user}.")
		if not state.enabled:
			frappe.throw(f"{user} is disabled, so an agent cannot run as them.")

	frappe.db.set_value("OS Agent Registry", agent, "run_as_user", user or None)
	frappe.db.commit()

	return next((a for a in list_agents() if a["agent_id"] == agent), None)
