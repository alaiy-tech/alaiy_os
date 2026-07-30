import frappe

# MAX_TOKENS lives with the client now (engine/ai_client.py); re-exported here
# for any callers that imported it from this module.
from alaiy_os.engine.ai_client import MAX_TOKENS  # noqa: F401


def _client():
	"""Resolve the active AI client via the `ai_client` hook.

	Scalar hook: the last app in the install order wins, so a managed bench's
	client app transparently replaces the default BYOK client here.
	"""
	paths = frappe.get_hooks("ai_client")
	if not paths:
		frappe.throw("No `ai_client` hook registered.")
	return frappe.get_attr(paths[-1])()


def complete(model, system, messages, tools=None):
	return _client().complete(model, system, messages, tools=tools)
