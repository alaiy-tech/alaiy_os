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

An agent's read tools are on the flat surface too (see `_pack_tools`), so the
model *could* call `listing__get_product`, look at the data, and write something
listing-shaped in prose. It would look like an answer. It would have none of the
agent's prompt, none of the channel's rules, and nothing would be saved — and the
validator that catches a banned phrase or a title three characters too long never
runs. The description below says so in as many words, because that is the failure
this tool exists to prevent and the model has every tool it needs to fall into it.
"""

import frappe

from alaiy_os.chat import skills as chat_skills
from alaiy_os.engine import executor

TOOL = "run_agent"

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
		"**Use the agent rather than doing its job yourself.** Some of an agent's "
		"own read tools are also on your tool list, so you can usually fetch the "
		"same data and write something that looks like the answer. Do not: you "
		"would be working without that agent's instructions and without the "
		"validation it runs before saving, and nothing you wrote would be saved at "
		"all. If a request matches an agent above, call this tool.\n\n"
		"**Do not gather data first.** The agent reads whatever it needs itself, "
		"through its own tools, as its first step. Looking the product up before "
		"delegating tells you nothing the agent will not find, and costs a round "
		"trip each time. Go straight to this tool; use those read tools only to "
		"answer a question on their own, where no agent is being run at all.\n\n"
		"**Diagnosing a problem is not fixing it.** Other tools can often tell you "
		"what is wrong — why a listing is suppressed, what a channel rejected — and "
		"reporting that back is a fine answer to 'what is wrong with this?'. It is "
		"not an answer to 'fix this', 'sort this out', 'it isn't selling' or "
		"anything else that asks for the problem to go away. Those are requests for "
		"the work, and the work is the agent's. Explaining the fault and stopping "
		"leaves the user exactly where they started.\n\n"
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

	# In-process, not enqueued. This already runs on a worker inside the turn, and
	# enqueuing a child job then polling for it would deadlock a single-worker
	# bench — the same reason `skills.run_skill` calls `run_now`.
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
