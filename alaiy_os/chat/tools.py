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

## Tenant tool sources

FAC's checks are Frappe's: a role holds a doctype's read permission, or it does
not. A deployment whose access rules are narrower than that — rows scoped to the
brands a person is assigned, say — cannot express them through the registry, so
its users would reach the whole dataset through a generic tool even though every
screen in the product scopes them. `chat_tool_sources` is the seam for a tenant
app to close that gap:

    chat_tool_sources = ["alaiy_os_globali.chat_tools.source"]

Each entry is a dotted path to a callable taking no arguments and returning a
dict (or None to contribute nothing — how an app opts out per user or per site):

    {
      "name":   "globali",                                  # provenance, for logs
      "filter": fn(names: list[str]) -> list[str],          # optional
      "tools":  [{"name", "description", "input_schema",    # optional
                  "run": fn(arguments) -> object}],
    }

`filter` may only NARROW. Whatever it returns is intersected with what it was
given, so a source cannot hand a user a tool core did not already offer them,
and several sources compose by chained intersection — the surface only ever
shrinks. A source's own `tools` are its to define, but a name that collides with
an FAC tool is rejected rather than shadowing it; prefix them.

**This module fails closed, and that is deliberate.** `runner._tenant_context`
and `mentions.sources` both swallow a broken hook and carry on, because a
missing paragraph or a thin `@` picker is a cosmetic loss. Here the same bargain
would hand a scoped user the unscoped tool surface — a disclosure, not a
degradation. So any exception raised while loading a source, running its
`filter`, or listing its `tools` empties `tool_specs()` and makes `call_tool()`
refuse, for every user, until it is fixed. The symptom is an assistant that says
it has no tools; the cause is in the error log, under the source's name.
"""

import frappe

# Anthropic and MCP describe a tool's arguments with the same JSON Schema under
# two different key names. This is the whole translation layer.
FAC_SCHEMA_KEY = "inputSchema"
ANTHROPIC_SCHEMA_KEY = "input_schema"

EMPTY_SCHEMA = {"type": "object", "properties": {}}

HOOK = "chat_tool_sources"


class _SourceError(Exception):
	"""A tenant tool source could not be evaluated.

	Never escapes this module: both entry points catch it and turn it into "no
	tools", so a broken policy denies rather than falls open.
	"""


def tool_specs():
	"""Anthropic tool specs for every tool the *current user* may call.

	Order and membership follow FAC's own filtering, narrowed by any tenant
	source, so what the model sees here matches what the same user would see
	over MCP minus whatever the deployment withholds.
	"""
	try:
		specs, _ = _surface()
	except _SourceError:
		return []
	return specs


def call_tool(name, arguments=None):
	"""Run one tool as the current user. Raises on denial or tool failure.

	The caller (chat.runner) turns a raise into a `tool_result` marked
	`is_error`, so the model sees the failure and can correct itself — the same
	call the batch executor makes.

	This is the gate, not `tool_specs()`: a model can name a tool it was never
	offered — from earlier in the conversation, or by guessing — so the whole
	surface is rebuilt and re-checked here rather than trusting what was
	advertised at the top of the turn.
	"""
	try:
		specs, provided = _surface()
	except _SourceError:
		raise PermissionError(
			f"Tool '{name}' is unavailable: this site's tool policy could not be evaluated."
		)

	if name not in {spec["name"] for spec in specs}:
		raise PermissionError(f"Tool '{name}' is not available to you.")

	tool = provided.get(name)
	if tool:
		return tool["run"](arguments or {})

	registry = _registry()
	if registry is None:
		frappe.throw("Frappe Assistant Core is not installed on this site, so no tools are available.")
	return registry.execute_tool(name, arguments or {})


def _surface():
	"""`(specs, provided)` — the full tool surface for the current user.

	One builder for both entry points, so what is advertised and what is
	permitted can never disagree. Raises `_SourceError` if any tenant source
	failed.
	"""
	sources = _sources()
	fac = _fac_specs()
	provided = _provided(sources)

	clash = sorted(set(provided) & {spec["name"] for spec in fac})
	if clash:
		frappe.log_error(title=f"Chat tool name collision with FAC: {', '.join(clash)}")
		raise _SourceError("name collision")

	kept = set(_narrow([spec["name"] for spec in fac], sources))
	specs = [spec for spec in fac if spec["name"] in kept]
	specs.extend(
		{
			"name": tool["name"],
			"description": tool.get("description") or "",
			ANTHROPIC_SCHEMA_KEY: tool.get(ANTHROPIC_SCHEMA_KEY) or EMPTY_SCHEMA,
		}
		for tool in provided.values()
	)

	# The site allow-list applies last and to everything, tenant tools included:
	# a site that pins `chat_tools` is stating the complete list, so a new tool
	# has to be named there before it can be reached.
	allowed = set(frappe.conf.get("chat_tools") or [])
	if allowed:
		specs = [spec for spec in specs if spec["name"] in allowed]
	return specs, provided


def _fac_specs():
	"""Every FAC tool the current user may call, as Anthropic specs."""
	registry = _registry()
	if registry is None:
		return []
	specs = []
	for meta in registry.get_available_tools(user=frappe.session.user):
		name = meta.get("name")
		if not name:
			continue
		specs.append(
			{
				"name": name,
				"description": meta.get("description") or "",
				ANTHROPIC_SCHEMA_KEY: meta.get(FAC_SCHEMA_KEY) or EMPTY_SCHEMA,
			}
		)
	return specs


def _sources():
	"""Registered tenant sources as `(entry, source)`, in hook order."""
	found = []
	for entry in frappe.get_hooks(HOOK) or []:
		try:
			source = frappe.get_attr(entry)()
		except Exception:
			frappe.log_error(title=f"Chat tool source {entry} failed to load")
			raise _SourceError(entry)
		if source:
			found.append((entry, source))
	return found


def _narrow(names, sources):
	"""`names` reduced by every source's filter. Intersect-only, in hook order."""
	for entry, source in sources:
		fn = source.get("filter")
		if not callable(fn):
			continue
		try:
			kept = set(fn(list(names)) or [])
		except Exception:
			frappe.log_error(title=f"Chat tool source {entry} failed to filter")
			raise _SourceError(entry)
		names = [name for name in names if name in kept]
	return names


def _provided(sources):
	"""`{name: tool}` for every tool the sources contribute themselves."""
	tools = {}
	for entry, source in sources:
		try:
			offered = list(source.get("tools") or [])
		except Exception:
			frappe.log_error(title=f"Chat tool source {entry} failed to list its tools")
			raise _SourceError(entry)
		for tool in offered:
			name = tool.get("name")
			if not name or not callable(tool.get("run")):
				continue
			if name in tools:
				frappe.log_error(title=f"Chat tool source {entry} redefines tool '{name}'")
				raise _SourceError(entry)
			tools[name] = tool
	return tools


def _registry():
	"""FAC's tool registry, or None on a site without FAC."""
	if "frappe_assistant_core" not in frappe.get_installed_apps():
		return None
	from frappe_assistant_core.core.tool_registry import get_tool_registry

	return get_tool_registry()
