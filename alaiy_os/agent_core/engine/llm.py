import frappe

MAX_TOKENS = 4096


def complete(model, system, messages, tools=None):
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
