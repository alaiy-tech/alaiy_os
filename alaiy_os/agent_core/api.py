"""REST surface for the agent engine.

POST /api/method/alaiy_os.agent_core.api.run_agent   -> {"run": "RUN-..."}
GET  /api/method/alaiy_os.agent_core.api.get_run     -> status/output/error
"""

import json

import frappe

from alaiy_os.agent_core.engine.executor import execute_agent


@frappe.whitelist()
def run_agent(agent, payload=None):
	if not frappe.has_permission("OS Agent Run", "create"):
		frappe.throw("Not permitted.", frappe.PermissionError)
	if isinstance(payload, str) and payload:
		payload = json.loads(payload)
	return {"run": execute_agent(agent, payload=payload, trigger_type="API")}


@frappe.whitelist()
def get_run(run):
	doc = frappe.get_doc("OS Agent Run", run)
	doc.check_permission("read")
	return {
		"run": doc.name,
		"agent": doc.agent,
		"status": doc.status,
		"output": doc.output,
		"error": doc.error,
		"input_tokens": doc.input_tokens,
		"output_tokens": doc.output_tokens,
		"started_at": doc.started_at,
		"ended_at": doc.ended_at,
	}
