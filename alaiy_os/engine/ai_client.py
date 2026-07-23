"""The AI client seam.

`llm.complete()` does not construct a provider client itself; it asks for one
via the `ai_client` hook and delegates. This is the single override point for
managed deployments: a private app (e.g. alaiy_os_ai_client) installed after
this one re-registers the scalar `ai_client` hook to point at its own factory,
and — because Frappe resolves scalar hooks by install order (last app wins) —
its client is used with no change to agent or executor code.

A client is any object exposing:

    complete(model, system, messages, tools=None) -> dict

returning the shape the executor consumes:

    {"content": [<block dict>, ...],
     "stop_reason": str,
     "usage": {"input_tokens": int, "output_tokens": int}}

The default below is the BYOK (bring-your-own-key) client: it talks to
Anthropic directly using a key the customer supplies in site_config. Managed
benches override the seam so the same Anthropic wire format is spoken against
our LiteLLM proxy instead.
"""

import frappe

MAX_TOKENS = 4096


class ByokClient:
	"""Default client: Anthropic direct, customer-supplied key."""

	def complete(self, model, system, messages, tools=None):
		import anthropic

		api_key = frappe.conf.get("anthropic_api_key")
		if not api_key:
			frappe.throw("Set anthropic_api_key in site_config.json before running agents.")

		client = anthropic.Anthropic(api_key=api_key)
		kwargs = {
			"model": model,
			"max_tokens": MAX_TOKENS,
			"system": system,
			"messages": messages,
		}
		if tools:
			kwargs["tools"] = tools

		response = client.messages.create(**kwargs)
		return {
			"content": [block.model_dump() for block in response.content],
			"stop_reason": response.stop_reason,
			"usage": {
				"input_tokens": response.usage.input_tokens,
				"output_tokens": response.usage.output_tokens,
			},
		}


def get_ai_client():
	"""Default factory registered on the `ai_client` hook."""
	return ByokClient()
