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

There are none. A skill runs its agent with no payload, on that agent's own
default window, and refinement happens conversationally in the next message.
`agent_meta` can grow an input schema later without changing this file's
contract — the dispatch would fill a payload where today it passes None.

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
"""

import frappe

from alaiy_os.engine import executor

# The agent's output is already a compact summary object; the cap is a backstop
# against a Text-format agent that returns a whole report, matching the ceiling
# `runner._truncate` puts on any other tool result.
MAX_OUTPUT_CHARS = 20_000


def catalogue():
	"""Every skill on this site, for the `/` picker.

	Not filtered by user: the agents are opt-in read-only (see the module
	docstring) and their tools do their own permission filtering, so a skill a
	user may not get much out of returns a thin answer rather than being hidden.
	Hiding it would need a per-agent permission model that does not exist yet.
	"""
	rows = frappe.get_all(
		"OS Agent Registry",
		filters={"is_enabled": 1, "chat_skill": 1},
		fields=["name", "agent_name", "skill_slug", "skill_label", "description", "icon"],
		order_by="skill_slug asc",
	)
	return [
		{
			"slug": row.skill_slug,
			"label": row.skill_label or row.agent_name,
			"description": row.description,
			"icon": row.icon,
		}
		for row in rows
	]


def resolve(slug):
	"""The agent name behind a slug. Throws with a usable message if there isn't one."""
	slug = (slug or "").strip().lstrip("/").lower()
	agent = frappe.db.get_value(
		"OS Agent Registry", {"skill_slug": slug, "chat_skill": 1, "is_enabled": 1}, "name"
	)
	if not agent:
		frappe.throw(f"There is no skill called /{slug}.")
	return agent


def run_skill(session, slug, append):
	"""Run the skill's agent and write the tool_use/tool_result pair into `session`.

	`append` is `runner._append`, passed in rather than imported: runner imports
	this module to dispatch, so importing it back would be a cycle.

	Returns nothing. The turn continues into `runner._loop`, which sees the tool
	result as the last thing in the history and narrates it.
	"""
	agent = resolve(slug)
	run = executor.run_now(agent, payload=None, trigger_type="Chat")

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
	call_id = f"skill_{run}"
	append(
		session,
		"assistant",
		[{"type": "tool_use", "id": call_id, "name": f"skill:{slug}", "input": {}}],
	)
	result = {"type": "tool_result", "tool_use_id": call_id, "content": content}
	if is_error:
		result["is_error"] = True
	append(session, "user", [result])
	frappe.db.commit()
