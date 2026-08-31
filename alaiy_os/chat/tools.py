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

## Core's own tools

Core contributes a small number of tools itself — `_core_tools()`, currently just
`create_download` — in the same shape a tenant source uses, because one shape for
a provided tool is simpler than two. They are **not** privileged: their names go
through every tenant `filter` alongside FAC's, so a deployment that does not want
its scoped users exporting spreadsheets can say so, and the site `chat_tools`
allow-list still applies last and to them too.

**This module fails closed, and that is deliberate.** `runner._tenant_context`
and `mentions.sources` both swallow a broken hook and carry on, because a
missing paragraph or a thin `@` picker is a cosmetic loss. Here the same bargain
would hand a scoped user the unscoped tool surface — a disclosure, not a
degradation. So any exception raised while loading a source, running its
`filter`, or listing its `tools` empties `tool_specs()` and makes `call_tool()`
refuse, for every user, until it is fixed. The symptom is an assistant that says
it has no tools; the cause is in the error log, under the source's name.

That takes core's own tools down with it. It has to — there is one code path —
and it is the right way round: a source that cannot be evaluated cannot say
whether this user may export anything.
"""

import json

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
	core = {tool["name"]: tool for tool in _core_tools()}
	packs = {tool["name"]: tool for tool in _pack_tools()}
	tenant = _provided(sources)

	# Four-way, not two: a tenant tool shadowing a core one is the same accident
	# as one shadowing an FAC tool, and precedence-by-import-order is exactly
	# what this check exists to refuse. Pack names are namespaced by pack id, so
	# they should never collide — they are checked anyway, because "should never"
	# is what this list is for.
	local = [core, packs, tenant]
	fac_names = {spec["name"] for spec in fac}
	clash = set()
	for i, group in enumerate(local):
		clash |= set(group) & fac_names
		for other in local[i + 1 :]:
			clash |= set(group) & set(other)
	if clash:
		frappe.log_error(title=f"Chat tool name collision: {', '.join(sorted(clash))}")
		raise _SourceError("name collision")

	provided = {**core, **packs, **tenant}

	# Core's and the packs' names are narrowed with FAC's rather than bypassing
	# `_narrow` with the tenant tools. A `filter` may only ever shrink what it was
	# given, so nothing is at risk — and it is the only way a deployment can
	# withhold a core or pack tool from a scoped role.
	offered = [spec["name"] for spec in fac] + list(core) + list(packs)
	kept = set(_narrow(offered, sources))

	# Pack tools lead. The order in this list is the order the model reads, and a
	# curated connector tool should be the first thing it considers for a question
	# about that connector — a generic `list_documents` over the same doctype is a
	# worse answer, and it is the one the model reaches for when it sees it first.
	specs = [
		{
			"name": tool["name"],
			"description": tool.get("description") or "",
			ANTHROPIC_SCHEMA_KEY: tool.get(ANTHROPIC_SCHEMA_KEY) or EMPTY_SCHEMA,
		}
		for name, tool in packs.items()
		if name in kept
	]
	specs.extend(spec for spec in fac if spec["name"] in kept)
	specs.extend(
		{
			"name": tool["name"],
			"description": tool.get("description") or "",
			ANTHROPIC_SCHEMA_KEY: tool.get(ANTHROPIC_SCHEMA_KEY) or EMPTY_SCHEMA,
		}
		for name, tool in {**core, **tenant}.items()
		if name not in core or name in kept
	)

	# The site allow-list applies last and to everything, tenant tools included:
	# a site that pins `chat_tools` is stating the complete list, so a new tool
	# has to be named there before it can be reached.
	allowed = set(frappe.conf.get("chat_tools") or [])
	if allowed:
		specs = [spec for spec in specs if spec["name"] in allowed]
	return specs, provided


#: Separates a pack id from a tool id in the name the model sees. Two underscores
#: rather than a dot because Anthropic tool names are `^[a-zA-Z0-9_-]{1,64}$`.
#:
#: Namespacing is not decoration. It removes a whole class of failure — a pack
#: that names a tool `search` would otherwise collide with FAC's and, because
#: `_surface` refuses collisions rather than ranking them, take every tool on the
#: site down with it. It also tells the model which connector a tool belongs to
#: at the point it is choosing, which is most of what it needs to choose well.
PACK_SEPARATOR = "__"


def _pack_tools():
	"""Every enabled pack's tools, in the tenant-source shape.

	This is what lets "what is my account health?" reach a connector without the
	user naming one. The alternative — a `run_pack(pack, question)` dispatch tool
	over a nested loop — keeps the model's context smaller and is the right answer
	once there are enough packs for that to matter. Flat is right while there are
	two: the model sees the actual tools, so it picks one on its description
	rather than on a summary of a pack, and there is no second loop to budget.

	**Read the note on effect before letting a pack register a write tool.** Every
	tool here is directly callable by the model, and `OS Agent Tool` has no
	`effect` field yet, so nothing in a row can tell this module that a tool
	publishes. Both packs on this site register reads only and say so in their
	manifests; that is a property of those manifests, not a guarantee this code
	enforces.

	Two gates, both mirroring `engine/factory.py` so a tool cannot be reachable
	here and refused there:

	  - the connector must be enabled, when the row names one;
	  - the user must hold what the row declares, so the surface never advertises
	    a tool whose first call would be a refusal. A row declaring nothing is not
	    filtered — `unmet` returns empty for it, the same way factory treats it.
	"""
	from alaiy_os.engine import permissions

	tools = []
	for agent_id in frappe.get_all(
		"OS Agent Registry", filters={"is_enabled": 1}, pluck="name", order_by="name asc"
	):
		doc = frappe.get_cached_doc("OS Agent Registry", agent_id)
		for row in doc.tools:
			if row.connector and not frappe.db.get_value(
				"OS Connector Registry", row.connector, "is_enabled"
			):
				continue
			if permissions.unmet([row.as_dict()], frappe.session.user):
				continue
			tools.append(_pack_tool(doc, row))
	return tools


def _pack_tool(agent, row):
	"""One `OS Agent Tool` row as a callable tool spec."""
	schema = EMPTY_SCHEMA
	if row.parameters_schema:
		try:
			schema = json.loads(row.parameters_schema)
		except ValueError:
			# Validated by the child controller on save and re-checked every
			# migrate, so this means the row was edited by hand. An empty schema
			# is the safe read: the model sends nothing rather than guessing.
			frappe.log_error(title=f"Pack tool {row.tool_id} has unparseable parameters_schema")

	def run(arguments, _handler=row.handler):
		# Resolved per call, not at surface-build time: importing every pack's
		# handler module to *describe* the tools would pull each connector's
		# client into a turn that never calls one.
		return frappe.get_attr(_handler)(**(arguments or {}))

	return {
		"name": f"{agent.name}{PACK_SEPARATOR}{row.tool_id}",
		# The pack's own name leads, so a model scanning a flat list can see which
		# connector each tool speaks to before reading the description.
		"description": f"[{agent.agent_name}] {row.description or ''}".strip(),
		ANTHROPIC_SCHEMA_KEY: schema,
		"run": run,
	}


def _core_tools():
	"""Tools core provides itself, in the tenant-source shape.

	Imported here rather than at module scope: `artifacts` imports `exports`,
	which reaches for openpyxl and Frappe's pdf writer, and this module is
	imported on every turn including the ones that never write a file.

	`web_search` is offered only where the site can actually reach the web, which
	on this seam means a gateway rather than Anthropic direct. A tool that is
	always present and always fails would teach the model to keep trying it, and
	would have it telling users it can look things up on a bench where it cannot
	— the same discipline DOWNLOAD_PROMPT follows: never advertise a capability
	the turn does not have.
	"""
	from alaiy_os.chat.artifacts import TOOL_SPEC

	tools = [TOOL_SPEC]

	from alaiy_os.chat.websearch import TOOL_SPEC as WEB_SEARCH_SPEC
	from alaiy_os.engine import llm

	try:
		available = llm.web_search_support()
	except Exception:
		# Resolving the client reads site config and a hook. Neither failing is a
		# reason to take the whole tool surface down with it — and `_surface`
		# fails closed, so raising here would leave the user with no tools at all.
		frappe.log_error(title="chat web_search availability check failed")
		available = False

	if available:
		tools.append(WEB_SEARCH_SPEC)
	return tools


#: FAC tools hidden from the chat and from nothing else.
#:
#: `search` and `fetch` exist in FAC only to satisfy ChatGPT's MCP rule that a
#: connector expose tools named exactly that. They are thin wrappers over
#: `search_documents` and `get_document`, which are already on this surface under
#: names that say what they do — so in the chat they are pure duplicates, and
#: duplicates with the most grabbable names on the whole list.
#:
#: That is not theoretical. Asked "what is the weather today?", the model
#: correctly refused, correctly offered a web search, and was told "yes use a
#: search tool" — whereupon it called `search` twice, got this site's documents
#: back both times, and concluded it had no web access. `web_search` was on the
#: surface throughout. Five tools here have "search" in the name and one *is*
#: "search"; a model reaching for "a search tool" takes the literal match, and no
#: amount of prompt text outranks a tool name.
#:
#: Hidden here rather than disabled in FAC Tool Configuration on purpose:
#: unticking those rows would also strip them from FAC's MCP endpoint, which is
#: the one place they are the right answer.
_CHATGPT_SHIMS = frozenset({"search", "fetch"})


def _fac_specs():
	"""Every FAC tool the current user may call, as Anthropic specs."""
	registry = _registry()
	if registry is None:
		return []
	specs = []
	for meta in registry.get_available_tools(user=frappe.session.user):
		name = meta.get("name")
		if not name or name in _CHATGPT_SHIMS:
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
