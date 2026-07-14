"""Hydrates an OS Agent record into something the executor can run.

This is the "agent factory": agents vary as data (prompt, tools, output
format), so building one is reading a record and resolving its tool handlers
to Python callables — the same dotted-path trick OS Connector Registry uses.
"""

import json
from dataclasses import dataclass, field

import frappe

EMPTY_SCHEMA = {"type": "object", "properties": {}}


@dataclass
class RunnableAgent:
	agent_id: str
	model: str
	system_prompt: str
	max_turns: int
	output_format: str  # "Text" | "JSON"
	output_schema: dict | None
	tools: list = field(default_factory=list)  # LLM-facing tool specs
	handlers: dict = field(default_factory=dict)  # tool_id -> callable


def build_runnable(agent_id):
	agent = frappe.get_doc("OS Agent", agent_id)
	if not agent.is_enabled:
		frappe.throw(f"Agent {agent_id} is disabled.")

	tools, handlers = [], {}
	for row in agent.tools:
		tool = frappe.get_doc("OS Agent Tool", row.tool)
		if not tool.is_enabled:
			frappe.throw(f"Agent {agent_id} references disabled tool {tool.tool_id}.")
		handlers[tool.tool_id] = frappe.get_attr(tool.handler)
		tools.append(
			{
				"name": tool.tool_id,
				"description": tool.description,
				"input_schema": json.loads(tool.parameters_schema) if tool.parameters_schema else EMPTY_SCHEMA,
			}
		)

	output_schema = None
	system_prompt = agent.system_prompt
	if agent.output_format == "JSON":
		output_schema = json.loads(agent.output_schema)
		system_prompt += (
			"\n\nYour final reply must be a single JSON object matching this JSON Schema"
			" — no prose, no code fences:\n" + json.dumps(output_schema, indent=1)
		)

	return RunnableAgent(
		agent_id=agent.agent_id,
		model=agent.model,
		system_prompt=system_prompt,
		max_turns=agent.max_turns or 8,
		output_format=agent.output_format or "Text",
		output_schema=output_schema,
		tools=tools,
		handlers=handlers,
	)
