"""Settings surface for agents: who each runs as, and what each tool needs.

Two questions this answers, which the Desk list view cannot:

  1. Which agents exist, and who does each run as.
  2. For every tool, what permission does it need, and does the agent's
     Run As User actually have it right now.

(2) matters because an agent whose user cannot read Sales Invoice would not
fail loudly on its own — it would quietly report zeros, which is worse.
`frappe.get_list` returns an empty set for a user without permission, so an
under-permissioned agent looks like a quiet business day.

`engine/factory.py` enforces the same declarations against the same user
before every run, through the shared `engine/permissions.py`, so such a run
fails instead. This surface is where an operator sees that coming.
"""

import frappe

from alaiy_os.engine import permissions

# Agents run as Administrator when no user is set. Named rather than implied so
# the UI can say so out loud.
ADMINISTRATOR = "Administrator"


@frappe.whitelist()
def list_agents():
	"""Every registered agent with its permission readiness."""
	if not frappe.has_permission("OS Agent Registry", "read"):
		frappe.throw("Not permitted.", frappe.PermissionError)

	agents = []
	for row in frappe.get_all(
		"OS Agent Registry",
		fields=["name", "agent_id", "agent_name", "description", "run_as_user", "model"],
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
			"model": row.model,
			"run_as_user": user,
			"runs_as_administrator": not row.run_as_user,
			"tools": tool_views,
			"permissions_satisfied": not unmet,
			"unmet_permissions": unmet,
			# Anything that writes is a deliberate decision, so surface it at
			# agent level too.
			"writes": any(t["writes"] for t in tool_views),
		})

	return agents


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

	The change is accepted even when the new user cannot satisfy the agent's
	tools: `engine/factory.py` re-checks the declarations, so such a run fails
	loudly instead of reporting zeros. The row comes back saying which
	permissions are missing.
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
