# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""
`run_agent` — letting the chat model hand a job to one of this site's agents.

`/listing ABC-123` already runs the listing agent, through `chat/skills.py`. This
is the other half: "write the Amazon listing for ABC-123", in the words someone
would actually use, reaching the same agent.

A slash command cannot cover that however good the client is. It is a command,
and a person describing what they want is not issuing one — so the model needs a
tool, and the tool needs to be *discoverable*: it can only hand work to an agent
it knows exists.

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

## The gate is `chat_skill`, deliberately

This runs exactly the agents `/` already offers — `skills.catalogue()`, which is
`chat_skill` ticked, `is_enabled`, and whatever `chat_skill_filter` leaves. No
second permission concept, and nothing reachable by describing a job that was not
already reachable by typing a slash.

That matters more than the tidiness. `chat_skill` is a claim about an agent —
that its tools enforce their own permissions, so running it as the chat session's
own user is safe. Inventing a separate list here would be inventing a second
answer to a question the registry already answers.

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

import frappe

from alaiy_os.chat import skills as chat_skills
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
	catalogue = chat_skills.catalogue()
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
				# `skills.validate_args`, against that agent's own declared schema,
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


def _description(catalogue):
	"""What the model reads when deciding whether to hand work over."""
	lines = []
	for item in catalogue:
		lines.append(f"- `{item['slug']}` — {item.get('description') or item['label']}")
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


def _charge(slug):
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


def _announce(agent, slug):
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
		# What the `/` picker calls it, falling back the same way the picker does,
		# so one agent is not "Amazon (SP-API)" here and `amazon_sp_api` there.
		label = frappe.db.get_value("OS Agent Registry", agent, "skill_label")
		runner.note(session, f"Asking {label or agent or slug}…")
		frappe.db.commit()  # nosemgrep: frapsec-manual-commit -- see docstring
	except Exception:
		frappe.log_error(title=f"Could not write progress line for agent {slug}")


def run(arguments):
	"""Run one agent and return its output.

	Raises rather than returning an error, so `_dispatch_tools` marks the result
	`is_error` and the model reads it — the same correction loop a denied
	permission or a bad argument already takes.
	"""
	slug = (arguments.get("agent") or "").strip().lstrip("/").lower()
	if not slug:
		frappe.throw("run_agent needs the name of the agent to run.")

	# Resolves against the same catalogue the `/` picker uses, and refuses an
	# agent this user may not run with the same message as one that does not
	# exist — the difference is not theirs to learn by probing.
	agent = chat_skills.resolve(slug)

	try:
		args = chat_skills.validate_args(slug, arguments.get("arguments"))
	except Exception as exc:
		# `validate_args` speaks in slash commands — "/listing needs product." That
		# is the right voice for the `/` path and the wrong one here: reached through
		# this tool, the fix is to nest that argument under `arguments`, and a model
		# told only the former spends a round trip working it out. Observed, on the
		# first natural-language run that got this far.
		frappe.throw(
			f"{exc} Call this tool as "
			f'{{"agent": "{slug}", "arguments": {{"<name>": "<value>"}}}} — the '
			"argument goes inside `arguments`, not beside it."
		)

	_charge(slug)
	_announce(agent, slug)

	# In-process, not enqueued. This already runs on a worker inside the turn, and
	# enqueuing a child job then polling for it would deadlock a single-worker
	# bench — the same reason `skills.run_skill` calls `run_now`.
	#
	# Sequential, therefore: two agents in one reply are two runs one after the
	# other, and a fan-out takes as long as its parts added up. That is the whole
	# reason `_announce` exists. Running them at once is a change to
	# `runner._run_tools`, which loops over the model's tool_use blocks — not a
	# change here.
	run_name = executor.run_now(agent, payload=args, trigger_type="Chat")

	# The traceback stays on the Run; what reaches the model is one line it can
	# relay and, where the failure is the user's to fix, act on. A refusal is
	# already that line — "no connector is installed" is the whole answer, and
	# relaying it beats sending someone to a Run record for it.
	output, is_error = executor.outcome(run_name, label=slug)
	if is_error:
		frappe.throw(output)

	if len(output) > MAX_OUTPUT_CHARS:
		output = output[:MAX_OUTPUT_CHARS] + f"\n… [truncated, {len(output)} chars total]"
	return output
