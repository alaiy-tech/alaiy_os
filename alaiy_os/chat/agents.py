# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""
`run_agent` — letting the chat model hand a job to one of this site's agents.

"write the Amazon listing for ABC-123", in the words someone would actually use,
reaching the listing agent.

A person describing what they want is not issuing a command, so the model needs
a tool, and the tool needs to be *discoverable*: it can only hand work to an
agent it knows exists.

## Why the description is built per request

`_core_tools()` is called on every turn, so `tool_spec()` is a function rather
than the module-level constant its neighbours use. It enumerates the site's
agents — their names, what each is for, and what each needs — directly into the
description the model reads.

That is the whole feature. A static description saying "you can run agents" is
useless to a model deciding whether to call it, because the answer depends
entirely on which agents this bench has: `listing` here, something else on the
next deployment, none at all on a bare install. Enumerating them is what turns
"create listings for this" into a call instead of an improvisation.

And a bench with no agents advertises nothing, on the same discipline
`_core_tools` already applies to `web_search`: never offer a capability the turn
does not have, or the model learns to keep trying it and to tell users it can do
things it cannot.

## Every agent is offered

Every `OS Agent Registry` row is on the list; there is no per-agent opt-in.
What scopes the data is who the run executes as: `executor.run_queued` adopts
the agent's Run As User when one is set, and otherwise the run keeps the chat
session's own user, whom `runner.run_turn` has already pinned — so every
`frappe.get_list` read a tool makes applies that user's row-level permissions.

Tools that write are reachable this way too. An agent whose tools write is only
as safe here as its own prompt and the permissions of the user it runs as.

## Why the model must not do this work itself

An agent's own tools are no longer on the chat surface — `_pack_tools` is gone,
and reaching a connector now means going through its agent. That removes the
sharpest version of this failure, where the model called `listing__get_product`
itself and wrote something listing-shaped in prose with none of the agent's
prompt, none of the channel's rules, nothing saved, and the validator that
catches a banned phrase or a title three characters too long never run.

The softer version survives, which is why the description below still spends a
paragraph on it. The generic document tools are still there, and a model that can
read an Item can still assemble an answer that looks like the work. It would be
the same answer with the same gaps.
"""

import json

import frappe

from alaiy_os.engine import executor
from alaiy_os.engine.context import get_chat_context

TOOL = "run_agent"

#: How many agents one chat turn may hand work to.
#:
#: A fan-out is the point of this tool — an ambiguous question is asked of every
#: channel at once — and it is also the way to spend a lot of money on a vague
#: one. Each delegation is a whole agent run: its own model, its own tools, its
#: own turn budget, several LLM calls deep. Three is enough for every channel on
#: the benches this ships to and short of "ask everything on the site".
#:
#: The model is told the number in the tool description, so it prioritises rather
#: than discovering the limit by hitting it.
MAX_DELEGATIONS_PER_TURN = 3

#: Where the count for the current turn lives. `frappe.local` is reset between
#: jobs and one chat turn is one job (`runner.run_turn` is enqueued per user
#: message), so the budget resets exactly when it should and cannot leak from one
#: turn into the next even in a long-lived worker.
_BUDGET_ATTR = "alaiy_chat_delegations"

#: The agent's output is already a compact object; the cap is a backstop against
#: a Text-format agent returning a whole report, and matches the ceiling
#: `runner._truncate` puts on any other tool result.
MAX_OUTPUT_CHARS = 20_000


def tool_spec():
	"""The tool, or None when this site has no agents worth offering."""
	catalogue = _catalogue()
	if not catalogue:
		return None

	return {
		"name": TOOL,
		"description": _description(catalogue),
		"input_schema": {
			"type": "object",
			"properties": {
				"agent": {
					"type": "string",
					"description": "Which agent to run, by the exact name listed in this tool's description.",
				},
				# A bare object, no declared properties. Each agent's arguments differ
				# and are described per agent above; declaring the union of them would
				# be rejected outright by the Gemini path, which takes an OpenAPI
				# subset and refuses a `"type"` union. What checks the shape is
				# `validate_args`, against that agent's own declared schema,
				# which refuses in words the model can act on.
				"arguments": {
					"type": "object",
					"description": "The agent's arguments, as named in its entry above. Omit for an agent that takes none.",
				},
			},
			"required": ["agent"],
		},
		"run": lambda arguments: run(arguments or {}),
	}


def _catalogue():
	"""Every agent on this site, for the tool description and for `validate_args`."""
	rows = frappe.get_all(
		"OS Agent Registry",
		fields=["name", "agent_name", "description", "input_schema"],
		order_by="name asc",
	)
	return [
		{
			"agent": row.name,
			"label": row.agent_name,
			"description": row.description,
			"input_schema": _parsed_schema(row.input_schema),
		}
		for row in rows
	]


def _parsed_schema(raw):
	"""An agent's declared input schema as a dict, or None.

	A manifest with unparseable JSON in the field is a bug in that agent, not a
	reason to hide it: the catalogue degrades to "takes no arguments" and
	`validate_args` then refuses anything sent, which is the safe direction. The
	log names the agent so it is fixable.
	"""
	if not (raw or "").strip():
		return None
	try:
		return json.loads(raw)
	except ValueError:
		frappe.log_error(title="Agent input_schema is not valid JSON")
		return None


def validate_args(agent, args):
	"""`args` as a dict ready for the executor, or throw with a usable message.

	An agent that declares no schema takes no arguments, and passing some is an
	error rather than something to silently drop — a caller sending arguments
	believes they matter, and an agent that ignores them would answer on its
	defaults while looking like it had listened.
	"""
	import jsonschema

	if isinstance(args, str):
		try:
			args = json.loads(args)
		except ValueError:
			frappe.throw(f"Arguments for {agent} are not valid JSON.")
	if args in (None, "", {}):
		args = None

	schema = _parsed_schema(frappe.db.get_value("OS Agent Registry", agent, "input_schema"))

	if args is None:
		# A schema with required keys cannot run on defaults; say which are missing
		# here rather than letting the agent answer a question nobody asked.
		missing = (schema or {}).get("required") or []
		if missing:
			frappe.throw(f"{agent} needs {', '.join(missing)}.")
		return None

	if not isinstance(args, dict):
		frappe.throw(f"Arguments for {agent} must be a JSON object.")
	if schema is None:
		frappe.throw(f"{agent} takes no arguments.")
	try:
		jsonschema.validate(args, schema)
	except jsonschema.ValidationError as e:
		frappe.throw(f"Arguments for {agent} are invalid: {e.message}")
	return args


def _description(catalogue):
	"""What the model reads when deciding whether to hand work over."""
	lines = []
	for item in catalogue:
		lines.append(f"- `{item['agent']}` — {item.get('description') or item['label']}")
		lines.extend(_argument_lines(item.get("input_schema") or {}))

	return (
		"Hand a job to one of this site's specialist agents and return what it "
		"produced. Each one has its own instructions, its own tools and its own "
		"rules, and does work this conversation cannot do properly by hand.\n\n"
		"Available on this site:\n" + "\n".join(lines) + "\n\n"
		"**Use the agent rather than doing its job yourself.** You can usually fetch "
		"similar data with the generic document tools and write something that looks "
		"like the answer. Do not: you would be working without that agent's "
		"instructions, without the rules for reading what its tools return, and "
		"without the validation it runs before saving — and nothing you wrote would "
		"be saved at all. If a request matches an agent above, call this tool.\n\n"
		"**Do not gather data first.** The agent reads whatever it needs itself, "
		"through its own tools, as its first step. Looking the product up before "
		"delegating tells you nothing the agent will not find, and costs a round "
		"trip each time. Go straight to this tool; use the generic tools only to "
		"answer a question on their own, where no agent is being run at all.\n\n"
		"**Diagnosing a problem is not fixing it.** Other tools can often tell you "
		"what is wrong — why a listing is suppressed, what a channel rejected — and "
		"reporting that back is a fine answer to 'what is wrong with this?'. It is "
		"not an answer to 'fix this', 'sort this out', 'it isn't selling' or "
		"anything else that asks for the problem to go away. Those are requests for "
		"the work, and the work is the agent's. Explaining the fault and stopping "
		"leaves the user exactly where they started.\n\n"
		"**Several agents, one turn.** A question can belong to more than one of "
		"them — 'which products are doing badly', on a site with more than one "
		"sales channel, is that question asked of each channel. Call this tool "
		"once per agent in the SAME reply and they all run; do not ask one, wait, "
		"read it, then ask the next. Ask only the agents the question actually "
		f"concerns, and at most {MAX_DELEGATIONS_PER_TURN} in one reply — past "
		"that the call is refused and you will have spent the budget on the wrong "
		"ones. If more would genuinely be needed, ask the user which they meant.\n\n"
		"**Keep their answers apart.** Each agent sees only its own channel and "
		"cannot see the others, so its summary is true of that channel alone. "
		"Report per channel, name the channel every time, and do not add a figure "
		"across channels unless you add up the rows they returned and say that you "
		"did. Two channels' tools may share a name and mean different things — one "
		"platform's own verdict on a listing, and this system's opinion of it — so "
		"relay each agent's words rather than merging them into one.\n\n"
		"Call it when the user asks for the work that agent does, in whatever "
		"words — 'write the Amazon listing for ABC-123', 'create listings for "
		"these', 'sort out this SKU', 'why is this suppressed'. Ask for the arguments it needs if "
		"they are missing rather than guessing them; an agent run costs money and "
		"takes a while, so one call with the right arguments beats three.\n\n"
		"Returns the agent's own output. Read it and answer in your own words — "
		"the user sees your reply, not this result. Where the agent reports what "
		"it could not fill in or wants reviewed, say so plainly rather than "
		"presenting the work as finished."
	)


def _argument_lines(schema):
	"""Each argument an agent takes, with the schema's own description of it.

	Names alone are not enough, and the gap is not theoretical. Told only
	`Needs: product`, the model filled it with the label it had been using in
	prose — "Quick Release Bumper Fastener Kit (SKU: 4125037034808)" — and the
	run died in `channels.resolve`, which looks the identifier up as a primary
	key and would have matched the bare `4125037034808`. The schema already said
	what that argument is; it was simply never shown to the one model that has to
	produce it, so the description was a guess every time.

	Optional arguments are listed too, for the same reason rather than for
	completeness: a model that cannot see `channel` cannot answer the run that
	comes back asking which channel to write for.
	"""
	properties = schema.get("properties") or {}
	if not properties:
		return ["    Takes no arguments."]

	required = set(schema.get("required") or ())
	return [
		f"    - `{name}`{'' if name in required else ' (optional)'} — "
		f"{(spec or {}).get('description') or 'No description.'}"
		for name, spec in properties.items()
	]


def _charge():
	"""Spend one delegation from this turn's budget, or refuse in words.

	Refuses through `frappe.throw`, so it reaches the model as a tool error it can
	act on — the same correction loop a bad argument takes — rather than failing
	the turn. A model that has already asked three agents and wants a fourth
	should answer with what it has, and it is told so.
	"""
	used = getattr(frappe.local, _BUDGET_ATTR, 0)
	if used >= MAX_DELEGATIONS_PER_TURN:
		frappe.throw(
			f"You have already run {used} agents this turn, which is the limit. "
			"Answer with what they returned, or ask the user which one they meant."
		)
	setattr(frappe.local, _BUDGET_ATTR, used + 1)


def _announce(agent):
	"""Tell the person which agent is being asked, before it is asked.

	A delegation is a whole agent run and they are sequential, so a question that
	reaches two channels is a minute in which a correct turn and a hung one look
	the same. This is the only thing between the two.

	Written and committed before the run starts, because the point is that a poll
	mid-turn sees it. Best-effort in every direction: a failure to write a
	progress line must never be the reason a working delegation does not happen,
	and outside a chat turn — the same tool reached from a script, say — there is
	no session and nothing to say.
	"""
	# Imported here, not at module scope: `chat/tools.py` imports this module from
	# inside `_core_tools()` to keep it off the import path of turns that never
	# delegate, and importing the runner at the top would undo that.
	from alaiy_os.chat import runner

	session = get_chat_context().get("session_id")
	if not session:
		return
	try:
		# The agent's display name, so one agent is not "Amazon (SP-API)" here and
		# `amazon_sp_api` elsewhere.
		label = frappe.db.get_value("OS Agent Registry", agent, "agent_name")
		runner.note(session, f"Asking {label or agent}…")
		frappe.db.commit()  # nosemgrep: frapsec-manual-commit -- see docstring
	except Exception:
		frappe.log_error(title=f"Could not write progress line for agent {agent}")


def run(arguments):
	"""Run one agent and return its output.

	Raises rather than returning an error, so `_dispatch_tools` marks the result
	`is_error` and the model reads it — the same correction loop a denied
	permission or a bad argument already takes.
	"""
	agent = (arguments.get("agent") or "").strip()
	if not agent:
		frappe.throw("run_agent needs the name of the agent to run.")
	if not frappe.db.exists("OS Agent Registry", agent):
		frappe.throw(f"There is no agent called {agent}.")

	try:
		args = validate_args(agent, arguments.get("arguments"))
	except Exception as exc:
		# Reached through this tool, the usual fix is to nest the argument under
		# `arguments`, and a model told only "listing needs product" spends a round
		# trip working that out. Observed, on the first natural-language run that
		# got this far.
		frappe.throw(
			f"{exc} Call this tool as "
			f'{{"agent": "{agent}", "arguments": {{"<name>": "<value>"}}}} — the '
			"argument goes inside `arguments`, not beside it."
		)

	_charge()
	_announce(agent)

	# In-process, not enqueued. This already runs on a worker inside the turn, and
	# enqueuing a child job then polling for it would deadlock a single-worker
	# bench.
	#
	# Sequential, therefore: two agents in one reply are two runs one after the
	# other, and a fan-out takes as long as its parts added up. That is the whole
	# reason `_announce` exists.
	#
	# Running them at once looks like a small change — `runner._run_tools` already
	# loops over the model's tool_use blocks, so a pool would drop straight in — and
	# it is not. Both routes were costed and neither is worth it yet:
	#
	#   * A thread pool would put this whole call in a worker thread, and a
	#     delegation is almost entirely Frappe work: a Run inserted and committed,
	#     `set_user`, a registry read, a tool loop of doctype reads, `db_set` on the
	#     way out, and `frappe.db.rollback()` on failure. A bare thread has no
	#     `frappe.local`, no connection and no session user, so each one would need
	#     its own `frappe.init`/`connect` — N more DB connections per turn, and a
	#     rollback path running alongside the parent's open transaction. This
	#     codebase's one threaded fan-out
	#     (alaiy_os_connector_shopify/listing/image_generation.py) exists under the
	#     opposite rule: it resolves every Frappe read on the calling thread first
	#     and keeps even `log_error` out of the workers.
	#
	#   * Enqueuing the children instead is clean per child — a real worker process
	#     with a real context — but `execute_agent` and `run_turn` both use
	#     `queue="long"`, so the parent would wait on children queued behind itself.
	#     That needs a dedicated queue and a documented worker count before it is
	#     parallel rather than merely deadlock-free.
	#
	# So the wait stays visible instead of short, and `_announce` is what makes it
	# legible. Revisit when a real fan-out's latency is the complaint.
	run_name = executor.run_now(agent, payload=args, trigger_type="Chat")

	# The traceback stays on the Run; what reaches the model is one line it can
	# relay and, where the failure is the user's to fix, act on. A refusal is
	# already that line — "no connector is installed" is the whole answer, and
	# relaying it beats sending someone to a Run record for it.
	output, is_error = executor.outcome(run_name, label=agent)
	if is_error:
		frappe.throw(output)

	if len(output) > MAX_OUTPUT_CHARS:
		output = output[:MAX_OUTPUT_CHARS] + f"\n… [truncated, {len(output)} chars total]"
	return output
