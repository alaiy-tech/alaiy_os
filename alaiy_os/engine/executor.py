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
from alaiy_os.engine.factory import build_runnable


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

	try:
		result = _run_loop(doc)
	except Exception as exc:
		# The conversation so far, when the loop got far enough to have one —
		# without it a failed run is undebuggable (the whole reason it failed is
		# usually IN the transcript, e.g. an empty final reply).
		messages = getattr(exc, "_agent_messages", None)
		# Undo any half-done tool side effects, then record the failure.
		frappe.db.rollback()
		doc.reload()
		doc.db_set(
			{
				"status": "Failed",
				"error": traceback.format_exc(),
				"transcript": json.dumps(_redact_media(messages), indent=1, default=str)
				if messages
				else None,
				"ended_at": now_datetime(),
			},
			commit=True,
		)
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
		try:
			value = agent.handlers[block["name"]](**(block["input"] or {}))
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
