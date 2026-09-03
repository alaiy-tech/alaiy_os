"""`/skills` — running a batch agent from inside a conversation.

A skill is not a second kind of thing to define. It is an `OS Agent Registry`
row that ticked `chat_skill`, so the catalogue is a query and there is nothing
to keep in sync: an agent app declares its skills in the same `agent_meta`
manifest it already writes, `sync_agent_registry()` upserts them on every
migrate, and every tenant's agent bundle gets the feature without a change here.

## How a skill lands in the thread

`/daily-digest` does *not* bypass the chat model. It runs the agent first, then
hands the result to the model as a tool result, so the turn continues normally:

    user      "/daily-digest"                       (skill_used = daily-digest)
    assistant [tool_use  name="skill:daily-digest"] ← written by run_skill
    user      [tool_result <the agent's JSON>]      ← written by run_skill
    assistant "GMV was ₹4.2L yesterday, up 8%…"     ← the normal _loop

That shape is deliberate. It is the same Anthropic wire format every FAC tool
call already produces, so nothing new has to render, `_trim` keeps the pair
together for free, and the model turns the agent's schema-validated JSON into
prose — which is the whole reason we can stay on markdown responses instead of
inventing a block format for stat tiles. Follow-ups ("break that down by
channel") then work like any other conversation, because the numbers are in the
history.

## Arguments

Most skills take none: the agent runs on its own defaults and refinement happens
conversationally in the next message. A pack that needs an argument declares an
`input_schema` in the same `agent_meta` manifest, and it reaches the agent as the
run's `input` — so a skill that takes arguments and one that does not are the
same dispatch with a payload or a None.

The path from a typed line to a validated payload is three narrow steps, in this
order, all on the *send* rather than the worker:

    fill_from_text   `/listing ABC-123` -> {"product": "ABC-123"}, but only for a
                     schema with exactly one required string property
    validate_args    against the declared schema, throwing with a usable message
    _skill_text      the words the user sees in their own bubble, when the client
                     sent arguments but no text of its own

A skill declaring no schema still takes none, and passing some is an error rather
than something to silently drop — a caller sending arguments believes they matter,
and a pack that ignored them would answer on its defaults while looking like it
had listened.

## Permissions

The gate is NOT `OS Agent Run`'s permission: that doctype grants System Manager
only, which would put skills out of reach of exactly the account and brand
managers they are for. The Run row is an audit artefact, not a capability.

What actually protects the data is that `run_turn` has already pinned the worker
to the session's owner, so every tool handler executes as that user and its
`frappe.get_list` reads apply their row-level permissions. That makes
`chat_skill` a claim about the agent — "every tool here enforces its own
permissions and none of them write" — which is why it is opt-in per agent and
says so on the field.

That claim is only as good as the row-level permissions behind it. Where a
deployment's access rules are narrower than Frappe's — brands assigned per user,
say — an agent's `get_list` reads do not express them, and its output is
site-wide however it was triggered. `chat_skill_filter` lets that deployment say
so:

    chat_skill_filter = ["alaiy_os_globali.chat_skills.filter_skills"]

Each entry is a dotted path to `fn(slugs: list[str]) -> list[str]`. Intersect
only — a filter may hide a skill, never reveal one — and fail closed: an entry
that raises hides every skill rather than falling back to the full list, for the
same reason `chat.tools` does (see that module's docstring).
"""

import json

import frappe

from alaiy_os.engine import executor

HOOK = "chat_skill_filter"

# The agent's output is already a compact summary object; the cap is a backstop
# against a Text-format agent that returns a whole report, matching the ceiling
# `runner._truncate` puts on any other tool result.
MAX_OUTPUT_CHARS = 20_000


def catalogue():
	"""Every skill this user may run, for the `/` picker.

	Core has no per-agent permission model of its own: the agents are opt-in
	read-only (see the module docstring) and their tools do their own permission
	filtering, so by default a skill a user gets little out of returns a thin
	answer rather than being hidden. A deployment whose scoping the agents
	cannot express narrows the list through `chat_skill_filter`.
	"""
	rows = frappe.get_all(
		"OS Agent Registry",
		filters={"is_enabled": 1, "chat_skill": 1},
		fields=[
			"name",
			"agent_name",
			"skill_slug",
			"skill_label",
			"description",
			"icon",
			"input_schema",
		],
		order_by="skill_slug asc",
	)
	permitted = _permitted([row.skill_slug for row in rows])
	return [
		{
			"slug": row.skill_slug,
			"label": row.skill_label or row.agent_name,
			"description": row.description,
			"icon": row.icon,
			# The schema, parsed, or None for a skill that takes no arguments. The
			# picker renders a form from it; a caller that ignores it sends nothing
			# and gets the pack's own defaults, which is what every skill did
			# before arguments existed.
			"input_schema": _parsed_schema(row.input_schema),
		}
		for row in rows
		if row.skill_slug in permitted
	]


def _parsed_schema(raw):
	"""A pack's declared input schema as a dict, or None.

	A manifest with unparseable JSON in the field is a bug in that pack, not a
	reason to hide the skill: the catalogue degrades to "takes no arguments" and
	`validate_args` then refuses anything sent, which is the safe direction. The
	log names the pack so it is fixable.
	"""
	if not (raw or "").strip():
		return None
	try:
		return json.loads(raw)
	except ValueError:
		frappe.log_error(title="Skill input_schema is not valid JSON")
		return None


def _schema_for(slug):
	"""The declared input schema for `slug`, or None."""
	for item in catalogue():
		if item["slug"] == slug:
			return item["input_schema"]
	return None


def fill_from_text(slug, args, text):
	"""Use the words typed alongside the command as the skill's one argument.

	`/listing ABC-123` should work: the client sends the slug it matched and the
	line the user typed, and the rest of that line *is* the argument. Without this
	a picker has to grow a form per skill before any skill with a required argument
	can be used at all.

	**The command itself is stripped here, not by the client.** Both clients send
	the whole line, because the user's own chat bubble has to read back as what
	they typed — so `text` arrives as `/listing ABC-123` and the argument is what
	follows the slug. Doing it server-side also means a client that *did* strip it
	is equally correct: there is then no leading slug to remove and the line is
	already the argument.

	Deliberately narrow. It fills only when the schema has exactly ONE required
	property and that property is a string, because that is the only case where
	the mapping is unambiguous — a skill wanting `sku` and `marketplace` cannot
	guess which half of a sentence is which, and should get a form instead. An
	explicit `skill_args` always wins; this is the fallback, not the path.
	"""
	if args not in (None, "", {}):
		return args
	text = (text or "").strip()
	if text.lower().startswith(f"/{slug}"):
		text = text[len(slug) + 1 :].strip()
	if not text:
		# `/listing` on its own. Leave args unfilled so `validate_args` can say
		# which argument is missing, rather than filling it with an empty string
		# and letting the agent run on nothing.
		return args

	schema = _schema_for(slug) or {}
	required = schema.get("required") or []
	if len(required) != 1:
		return args
	key = required[0]
	if (schema.get("properties") or {}).get(key, {}).get("type") != "string":
		return args
	return {key: text}


def validate_args(slug, args):
	"""`args` as a dict ready for the executor, or throw with a usable message.

	Called on the *send*, not on the worker, for the same reason `resolve` is: a
	malformed argument should come back as an error on the request the user made,
	not as a conversation that quietly answered something else a minute later.

	A skill that declares no schema takes no arguments, and passing some is an
	error rather than something to silently drop — a caller sending arguments
	believes they matter, and a pack that ignores them would answer on its
	defaults while looking like it had listened.
	"""
	import jsonschema

	if isinstance(args, str):
		try:
			args = json.loads(args)
		except ValueError:
			frappe.throw(f"Arguments for /{slug} are not valid JSON.")
	if args in (None, "", {}):
		args = None

	schema = _schema_for(slug)

	if args is None:
		# A schema with required keys cannot run on defaults; say which are missing
		# here rather than letting the pack answer a question nobody asked.
		missing = (schema or {}).get("required") or []
		if missing:
			frappe.throw(f"/{slug} needs {', '.join(missing)}.")
		return None

	if not isinstance(args, dict):
		frappe.throw(f"Arguments for /{slug} must be a JSON object.")
	if schema is None:
		frappe.throw(f"/{slug} takes no arguments.")
	try:
		jsonschema.validate(args, schema)
	except jsonschema.ValidationError as e:
		frappe.throw(f"Arguments for /{slug} are invalid: {e.message}")
	return args


def resolve(slug):
	"""The agent name behind a slug. Throws with a usable message if there isn't one.

	Both entry points land here — `runner.start_turn` validating what the client
	sent, and `run_skill` in the worker — so this is where a filtered slug has to
	be refused, not just hidden from the picker. A skill the caller may not run
	gets the same message as one that does not exist: the difference is not
	theirs to learn by probing.
	"""
	slug = (slug or "").strip().lstrip("/").lower()
	agent = frappe.db.get_value(
		"OS Agent Registry", {"skill_slug": slug, "chat_skill": 1, "is_enabled": 1}, "name"
	)
	if not agent or slug not in _permitted([slug]):
		frappe.throw(f"There is no skill called /{slug}.")
	return agent


def _permitted(slugs):
	"""`slugs` narrowed by every registered filter. Empty if one of them fails."""
	for entry in frappe.get_hooks(HOOK) or []:
		try:
			kept = set(frappe.get_attr(entry)(list(slugs)) or [])
		except Exception:
			frappe.log_error(title=f"Chat skill filter {entry} failed")
			return set()
		slugs = [slug for slug in slugs if slug in kept]
	return set(slugs)


def run_skill(session, slug, append, args=None):
	"""Run the skill's agent and write the tool_use/tool_result pair into `session`.

	`append` is `runner._append`, passed in rather than imported: runner imports
	this module to dispatch, so importing it back would be a cycle.

	`args` is the validated payload from `validate_args` — already checked on the
	send, so nothing here re-validates. It reaches the agent as the run's `input`,
	which `executor._run_loop` uses as the opening user message, so a pack reads
	its arguments the same way it would read any other request.

	Returns nothing. The turn continues into `runner._loop`, which sees the tool
	result as the last thing in the history and narrates it.
	"""
	agent = resolve(slug)
	run = executor.run_now(agent, payload=args, trigger_type="Chat")

	doc = frappe.get_doc("OS Agent Run", run)
	if doc.status == "Success":
		content, is_error = doc.output or "", False
	else:
		# The traceback stays in the Run; what reaches the model is one line it
		# can relay. Same rule as a failed tool call — the model responds to the
		# failure rather than the turn dying on it.
		content = f"The {slug} agent failed. Run {run} has the details."
		is_error = True

	if len(content) > MAX_OUTPUT_CHARS:
		content = content[:MAX_OUTPUT_CHARS] + f"\n… [truncated, {len(content)} chars total]"

	# The id ties the pair together and names the Run, so a conversation is
	# traceable back to the agent execution that produced its numbers.
	#
	# `input` carries the real arguments rather than staying `{}`: the model reads
	# this block on every following turn, and it is what lets a follow-up like
	# "and the month before?" know what the first call actually asked for.
	call_id = f"skill_{run}"
	append(
		session,
		"assistant",
		[{"type": "tool_use", "id": call_id, "name": f"skill:{slug}", "input": args or {}}],
	)
	result = {"type": "tool_result", "tool_use_id": call_id, "content": content}
	if is_error:
		result["is_error"] = True
	append(session, "user", [result])
	frappe.db.commit()
