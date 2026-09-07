"""Run lifecycle + the LLM ⇄ tool loop.

Every invocation path (API, scheduler, doc events, manual) converges here:
``execute_agent()`` creates an OS Agent Run and enqueues it; nothing calls an
LLM inside a web request. Callers poll the Run record.
"""

import json
import traceback

import frappe
from frappe.utils import now_datetime

from alaiy_os.engine import llm
from alaiy_os.engine.context import agent_run
from alaiy_os.engine.factory import build_runnable


class ToolStop(Exception):
	"""A tool saying this run cannot continue, and why — in words for a person.

	The default for a failing tool is the opposite of this, and usually right:
	`_dispatch_tools` hands the traceback back to the model, which re-reads it and
	corrects itself. A bad argument, a channel id that does not exist, a validator
	listing what is wrong with a draft — all of those are the model's to fix, and
	ending the run on them would throw away a correction loop that works.

	Some failures are not the model's to fix. When what is missing is the
	*environment* — no connector installed for the work, a credential absent — no
	amount of re-reading changes it, and the model's own instinct is the worst
	available one: it is holding an output schema that demands a result, so it
	writes a plausible-looking one. That is how a run with no channel to write for
	ended up returning a listing whose title was "Product not found", from an agent
	whose prompt tells it in as many words not to write a listing anyway. A prompt
	cannot win that argument, because the schema is asking for the opposite.

	So this ends the run instead, at the tool, with `status = "Refused"` and this
	exception's message on the Run. **There is no output**, and that is the whole
	point: a refusal cannot be mistaken downstream for work that was done.

	Refused is not Failed. Nothing is broken — the site simply cannot do this — so
	it does not read as a bug in the list, and `error` holds a sentence someone can
	act on rather than a traceback. Both are still "not Success", so any caller
	already branching on that keeps working untouched.
	"""


def execute_agent(agent, payload=None, trigger_type="Manual"):
	"""Create a Run for `agent` and enqueue it. Returns the Run name."""
	_assert_runnable(agent)
	run = _new_run(agent, payload, trigger_type)

	frappe.enqueue(
		"alaiy_os.engine.executor.run_queued",
		queue="long",
		run=run,
		enqueue_after_commit=True,
	)
	return run


def run_now(agent, payload=None, trigger_type="Manual"):
	"""Create a Run for `agent` and execute it in this process. Returns the Run name.

	The synchronous twin of `execute_agent`, for a caller that is *already* on a
	worker and needs the result before it can continue — Ask Alaiy's `/skill`
	dispatch, which has to put the agent's output into the conversation before
	the chat model can narrate it (see `chat/skills.py`).

	Enqueuing from inside a job and then polling for the child would deadlock a
	single-worker bench, so this does not enqueue. The trade is that the caller
	owns the wait: never call this from a web request.

	Failure is not raised — `run_queued` records it on the Run and returns, the
	same as for a queued run. Read the Run's `status` to find out what happened.
	"""
	_assert_runnable(agent)
	run = _new_run(agent, payload, trigger_type)
	# `run_queued` reloads the Run and commits as it goes, so the row has to be
	# durable before it starts — the same guarantee `enqueue_after_commit` gives
	# the queued path.
	frappe.db.commit()
	run_queued(run)
	return run


def _assert_runnable(agent):
	enabled = frappe.db.get_value("OS Agent Registry", agent, "is_enabled")
	if enabled is None:
		frappe.throw(f"Agent {agent} does not exist.")
	if not enabled:
		frappe.throw(f"Agent {agent} is disabled.")


def _new_run(agent, payload, trigger_type):
	doc = frappe.get_doc(
		{
			"doctype": "OS Agent Run",
			"agent": agent,
			"trigger_type": trigger_type,
			"status": "Queued",
			"input": json.dumps(payload, indent=1) if payload is not None else None,
		}
	).insert(ignore_permissions=True)
	return doc.name


def run_queued(run):
	"""Worker entry point: executes one queued Run."""
	doc = frappe.get_doc("OS Agent Run", run)
	doc.db_set({"status": "Running", "started_at": now_datetime()}, commit=True)

	# Adopt the agent's service user, so every tool read inside this run is
	# scoped by that user's Roles and row-level permissions instead of seeing
	# the whole site. Unset means Administrator, which is the old behaviour and
	# is site-wide — deliberately explicit rather than implied.
	run_as = frappe.db.get_value("OS Agent Registry", doc.agent, "run_as_user")
	if run_as:
		frappe.set_user(run_as)

	try:
		# Publish which agent is spending so the AI client can attribute usage
		# per agent. The spend still comes from the site's single shared pool —
		# this labels it, it does not budget it.
		with agent_run(agent_id=doc.agent, run=doc.name, trigger=doc.trigger_type):
			result = _run_loop(doc)
	except Exception as exc:
		# The conversation so far, when the loop got far enough to have one —
		# without it a failed run is undebuggable (the whole reason it failed is
		# usually IN the transcript, e.g. an empty final reply).
		messages = getattr(exc, "_agent_messages", None)
		# Undo any half-done tool side effects, then record the failure.
		frappe.db.rollback()
		doc.reload()
		refused = isinstance(exc, ToolStop)
		doc.db_set(
			{
				"status": "Refused" if refused else "Failed",
				# A refusal is meant to be read — by the person who asked, through
				# whichever surface relayed it — so it keeps its sentence instead of a
				# traceback of the raise that carried it here.
				"error": str(exc) if refused else traceback.format_exc(),
				"transcript": json.dumps(_redact_media(messages), indent=1, default=str)
				if messages
				else None,
				"ended_at": now_datetime(),
			},
			commit=True,
		)
		if not refused:
			# A refusal is an expected answer, not a defect. Logging it would put a
			# site that has simply not installed a connector into the Error Log on
			# every run, which is how a log stops being read.
			frappe.log_error(title=f"OS Agent Run {run} failed")
		return

	doc.db_set(
		{
			"status": "Success",
			"output": result["output"],
			"transcript": json.dumps(_redact_media(result["messages"]), indent=1, default=str),
			"input_tokens": result["input_tokens"],
			"output_tokens": result["output_tokens"],
			"image_tokens": result["image_tokens"],
			"ended_at": now_datetime(),
		},
		commit=True,
	)


def outcome(run, label=None):
	"""What a caller should relay about a finished Run, as `(text, is_error)`.

	Three endings, and the difference between them is exactly what the person who
	asked needs to hear, so it is decided here rather than in each surface that
	runs an agent — `chat/skills.py` for `/listing`, `chat/agents.py` for a job
	handed over in plain language, and whatever comes next.

	A refusal relays its own words. That is the point of it: "no connector is
	installed" is the complete answer, and the surface in front of the user can
	say so instead of sending them to a Run record to find out. A genuine failure
	still does send them there, because its detail is a traceback and there is
	nothing in it for them.
	"""
	doc = frappe.get_doc("OS Agent Run", run)
	if doc.status == "Success":
		return doc.output or "", False
	if doc.status == "Refused":
		return doc.error or "", True
	return f"The {label or doc.agent} agent failed. Run {run} has the details.", True


def _run_loop(run_doc):
	agent = build_runnable(run_doc.agent)
	messages = [{"role": "user", "content": run_doc.input or "Run."}]
	usage = {"input_tokens": 0, "output_tokens": 0, "image_tokens": 0}

	try:
		response = None
		for _ in range(agent.max_turns):
			response = _call(agent, messages, usage)
			messages.append({"role": "assistant", "content": response["content"]})
			if response["stop_reason"] != "tool_use":
				break
			messages.append({"role": "user", "content": _dispatch_tools(agent, response["content"], usage)})
		else:
			frappe.throw(f"Agent {agent.agent_id} exceeded max_turns ({agent.max_turns}).")

		output = _final_text(response)
		if agent.output_format == "JSON":
			output, messages = _validate_json_output(agent, output, messages, usage)
	except Exception as exc:
		# Ride the transcript out on the exception so run_queued can store it
		# with the failure — a failed run without its conversation is opaque.
		exc._agent_messages = messages
		raise

	return {"output": output, "messages": messages, **usage}


def _call(agent, messages, usage):
	response = llm.complete(agent.model, agent.system_prompt, messages, tools=agent.tools or None)
	usage["input_tokens"] += response["usage"]["input_tokens"]
	usage["output_tokens"] += response["usage"]["output_tokens"]
	return response


def _dispatch_tools(agent, content, usage):
	results = []
	for block in content:
		if block["type"] != "tool_use":
			continue
		handler = agent.handlers.get(block["name"])
		if handler is None:
			# The model invented a tool. The common case is a pseudo-tool like
			# "none"/"done" used to signal it has finished — models reach for one
			# when a prompt tells them to stop calling tools. Answering that with
			# a traceback teaches nothing and costs real tokens: it is echoed back
			# on every following turn, and the model usually just tries again,
			# burning the turn budget. Say what exists and how to finish instead.
			results.append(_tool_result(
				block["id"],
				f"Unknown tool {block['name']!r}. Available tools: "
				f"{', '.join(sorted(agent.handlers))}. "
				"If you already have what you need, reply with your final answer "
				"instead of calling a tool.",
				is_error=True,
			))
			continue
		try:
			value = handler(**(block["input"] or {}))
			if isinstance(value, dict) and "_usage" in value:
				tool_usage = value.pop("_usage")
				usage["image_tokens"] += tool_usage.get("image_tokens", 0)
			if isinstance(value, dict) and "_content_blocks" in value:
				# Rich tool result: the handler supplies ready-made Anthropic
				# content blocks (e.g. image blocks for vision) instead of JSON.
				results.append(
					{"type": "tool_result", "tool_use_id": block["id"], "content": value["_content_blocks"]}
				)
			else:
				results.append(_tool_result(block["id"], json.dumps(value, default=str)))
		except ToolStop:
			# The one failure that does not go back to the model. It has said there
			# is nothing to recover to, and a model handed that still has a schema
			# telling it to produce something. See ToolStop.
			raise
		except Exception:
			# Tool failures go back to the LLM, not up the stack — it may recover.
			results.append(_tool_result(block["id"], traceback.format_exc(limit=3), is_error=True))
	return results


def _redact_media(messages):
	"""Strip base64 payloads (images) out of the stored transcript — they are
	megabytes of noise per run; keep a size stub so the tool call stays auditable."""
	for message in messages:
		content = message.get("content")
		if not isinstance(content, list):
			continue
		for block in content:
			if block.get("type") != "tool_result" or not isinstance(block.get("content"), list):
				continue
			for sub in block["content"]:
				source = sub.get("source") if sub.get("type") == "image" else None
				if isinstance(source, dict) and "data" in source:
					sub["source"] = {**source, "data": f"<{len(source['data'])} base64 chars redacted>"}
	return messages


def _tool_result(tool_use_id, content, is_error=False):
	result = {"type": "tool_result", "tool_use_id": tool_use_id, "content": content}
	if is_error:
		result["is_error"] = True
	return result


def _final_text(response):
	return "\n".join(b["text"] for b in response["content"] if b["type"] == "text").strip()


EMPTY_REPLY = "the model returned an empty reply"


def _validate_json_output(agent, output, messages, usage):
	"""Parse + schema-validate the final output; one corrective retry."""
	for attempt in range(2):
		parsed, problem = _check_json_output(agent, output)
		if problem is None:
			return parsed, messages
		if attempt == 1:
			frappe.throw(f"Output failed schema validation after retry: {problem}")
		messages.append({"role": "user", "content": _correction_prompt(problem)})
		response = _call(agent, messages, usage)
		messages.append({"role": "assistant", "content": response["content"]})
		output = _final_text(response)


def _check_json_output(agent, output):
	"""(formatted_json, None) when the reply satisfies the schema, else (None, why)."""
	import jsonschema

	stripped = _strip_code_fences(output)
	if not stripped:
		return None, EMPTY_REPLY
	try:
		parsed = json.loads(stripped)
		jsonschema.validate(parsed, agent.output_schema)
	except (ValueError, jsonschema.ValidationError) as e:
		return None, str(e)
	return json.dumps(parsed, indent=1), None


def _correction_prompt(problem):
	# The retry runs after the tool loop has ended, so the ask is the same either
	# way: produce the JSON. The empty case only needs wording that makes sense to
	# a model that said nothing — "your reply failed validation" does not.
	if problem == EMPTY_REPLY:
		return (
			"Your reply was empty. Reply with the complete JSON object as plain "
			"text, matching the schema you were given."
		)
	return (
		f"Your reply failed validation: {problem}\n"
		"Reply again with ONLY the corrected JSON object."
	)


def _strip_code_fences(text):
	text = text.strip()
	if text.startswith("```"):
		text = text.split("\n", 1)[1] if "\n" in text else ""
		if text.rstrip().endswith("```"):
			text = text.rstrip()[:-3]
	return text.strip()
