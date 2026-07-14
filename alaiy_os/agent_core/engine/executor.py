"""Run lifecycle + the LLM ⇄ tool loop.

Every invocation path (API, scheduler, doc events, manual) converges here:
``execute_agent()`` creates an OS Agent Run and enqueues it; nothing calls an
LLM inside a web request. Callers poll the Run record.
"""

import json
import traceback

import frappe
from frappe.utils import now_datetime

from alaiy_os.agent_core.engine import llm
from alaiy_os.agent_core.engine.factory import build_runnable


def execute_agent(agent, payload=None, trigger_type="Manual"):
	"""Create a Run for `agent` and enqueue it. Returns the Run name."""
	enabled = frappe.db.get_value("OS Agent", agent, "is_enabled")
	if enabled is None:
		frappe.throw(f"Agent {agent} does not exist.")
	if not enabled:
		frappe.throw(f"Agent {agent} is disabled.")

	run = frappe.get_doc(
		{
			"doctype": "OS Agent Run",
			"agent": agent,
			"trigger_type": trigger_type,
			"status": "Queued",
			"input": json.dumps(payload, indent=1) if payload is not None else None,
		}
	).insert(ignore_permissions=True)

	frappe.enqueue(
		"alaiy_os.agent_core.engine.executor.run_queued",
		queue="long",
		run=run.name,
		enqueue_after_commit=True,
	)
	return run.name


def run_queued(run):
	"""Worker entry point: executes one queued Run."""
	doc = frappe.get_doc("OS Agent Run", run)
	doc.db_set({"status": "Running", "started_at": now_datetime()}, commit=True)

	try:
		result = _run_loop(doc)
	except Exception:
		# Undo any half-done tool side effects, then record the failure.
		frappe.db.rollback()
		doc.reload()
		doc.db_set(
			{
				"status": "Failed",
				"error": traceback.format_exc(),
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
			"transcript": json.dumps(result["messages"], indent=1, default=str),
			"input_tokens": result["input_tokens"],
			"output_tokens": result["output_tokens"],
			"ended_at": now_datetime(),
		},
		commit=True,
	)


def _run_loop(run_doc):
	agent = build_runnable(run_doc.agent)
	messages = [{"role": "user", "content": run_doc.input or "Run."}]
	usage = {"input_tokens": 0, "output_tokens": 0}

	response = None
	for _ in range(agent.max_turns):
		response = _call(agent, messages, usage)
		messages.append({"role": "assistant", "content": response["content"]})
		if response["stop_reason"] != "tool_use":
			break
		messages.append({"role": "user", "content": _dispatch_tools(agent, response["content"])})
	else:
		frappe.throw(f"Agent {agent.agent_id} exceeded max_turns ({agent.max_turns}).")

	output = _final_text(response)
	if agent.output_format == "JSON":
		output, retry_messages = _validate_json_output(agent, output, messages, usage)
		messages = retry_messages

	return {"output": output, "messages": messages, **usage}


def _call(agent, messages, usage):
	response = llm.complete(agent.model, agent.system_prompt, messages, tools=agent.tools or None)
	usage["input_tokens"] += response["usage"]["input_tokens"]
	usage["output_tokens"] += response["usage"]["output_tokens"]
	return response


def _dispatch_tools(agent, content):
	results = []
	for block in content:
		if block["type"] != "tool_use":
			continue
		try:
			value = agent.handlers[block["name"]](**(block["input"] or {}))
			results.append(_tool_result(block["id"], json.dumps(value, default=str)))
		except Exception:
			# Tool failures go back to the LLM, not up the stack — it may recover.
			results.append(_tool_result(block["id"], traceback.format_exc(limit=3), is_error=True))
	return results


def _tool_result(tool_use_id, content, is_error=False):
	result = {"type": "tool_result", "tool_use_id": tool_use_id, "content": content}
	if is_error:
		result["is_error"] = True
	return result


def _final_text(response):
	return "\n".join(b["text"] for b in response["content"] if b["type"] == "text").strip()


def _validate_json_output(agent, output, messages, usage):
	"""Parse + schema-validate the final output; one corrective retry."""
	import jsonschema

	for attempt in range(2):
		try:
			parsed = json.loads(_strip_code_fences(output))
			jsonschema.validate(parsed, agent.output_schema)
			return json.dumps(parsed, indent=1), messages
		except (ValueError, jsonschema.ValidationError) as e:
			if attempt == 1:
				frappe.throw(f"Output failed schema validation after retry: {e}")
			messages.append(
				{
					"role": "user",
					"content": f"Your reply failed validation: {e}\n"
					"Reply again with ONLY the corrected JSON object.",
				}
			)
			response = _call(agent, messages, usage)
			messages.append({"role": "assistant", "content": response["content"]})
			output = _final_text(response)


def _strip_code_fences(text):
	text = text.strip()
	if text.startswith("```"):
		text = text.split("\n", 1)[1] if "\n" in text else ""
		if text.rstrip().endswith("```"):
			text = text.rstrip()[:-3]
	return text.strip()
