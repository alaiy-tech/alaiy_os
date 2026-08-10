"""The FAC bridge: the same MCP tools, resolved in-process.

Frappe Assistant Core's tool registry is what an external MCP client (Claude
Desktop) ultimately reaches — MCP is only a wire format layered on top of
`get_available_tools()` / `execute_tool()`. Calling those directly gives the
in-app chat the identical tool surface with no MCP transport, no OAuth round
trip, and no second copy of the permission rules: `execute_tool()` re-checks FAC
Tool Configuration (enabled + role access) and Frappe document permissions, and
audit-logs every call through `BaseTool._safe_execute`. Nothing here adds or
relaxes a check.

FAC is an optional dependency. It is absent from `required_apps` on purpose (see
hooks.py), so every entry point below degrades to "no tools" rather than raising
on a site without it — the chat still answers, it just cannot act.
"""

import frappe

# Anthropic and MCP describe a tool's arguments with the same JSON Schema under
# two different key names. This is the whole translation layer.
FAC_SCHEMA_KEY = "inputSchema"
ANTHROPIC_SCHEMA_KEY = "input_schema"

EMPTY_SCHEMA = {"type": "object", "properties": {}}


def tool_specs():
	"""Anthropic tool specs for every tool the *current user* may call.

	Order and membership follow FAC's own filtering, so what the model sees here
	matches what the same user would see over MCP.
	"""
	registry = _registry()
	if registry is None:
		return []

	allowed = set(frappe.conf.get("chat_tools") or [])
	specs = []
	for meta in registry.get_available_tools(user=frappe.session.user):
		name = meta.get("name")
		if not name or (allowed and name not in allowed):
			continue
		specs.append(
			{
				"name": name,
				"description": meta.get("description") or "",
				ANTHROPIC_SCHEMA_KEY: meta.get(FAC_SCHEMA_KEY) or EMPTY_SCHEMA,
			}
		)
	return specs


def call_tool(name, arguments=None):
	"""Run one tool as the current user. Raises on denial or tool failure.

	The caller (chat.runner) turns a raise into a `tool_result` marked
	`is_error`, so the model sees the failure and can correct itself — the same
	call the batch executor makes.
	"""
	registry = _registry()
	if registry is None:
		frappe.throw("Frappe Assistant Core is not installed on this site, so no tools are available.")

	# Re-check the allow-list here too: tool_specs() is advisory (it shapes what
	# the model knows about), this is the gate. A model can name a tool it was
	# never offered — from earlier in the conversation, or by guessing.
	allowed = set(frappe.conf.get("chat_tools") or [])
	if allowed and name not in allowed:
		raise PermissionError(f"Tool '{name}' is not enabled for chat on this site.")

	return registry.execute_tool(name, arguments or {})


def _registry():
	"""FAC's tool registry, or None on a site without FAC."""
	if "frappe_assistant_core" not in frappe.get_installed_apps():
		return None
	from frappe_assistant_core.core.tool_registry import get_tool_registry

	return get_tool_registry()
