import frappe

# MAX_TOKENS lives with the client now (engine/ai_client.py); re-exported here
# for any callers that imported it from this module. `Unsupported` too, so a
# caller can catch it without importing the client module directly.
from alaiy_os.engine.ai_client import MAX_TOKENS, Unsupported  # noqa: F401


def image_client():
	"""The active client, for a caller that renders images in parallel.

	Resolving the hook and reading site config both need a Frappe request
	context, which a worker thread does not have. Call this on the main thread and
	hand the instance to the pool: a client captures its image configuration at
	construction precisely so its image methods are then thread-safe.

	`generate_image` / `translate_image` below are the convenience path for a
	single call on the current thread; they go through here too.
	"""
	return _client()


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


def generate_image(prompt, reference_data_uri=None):
	"""One generated image -> {"b64", "media_type", "usage"}.

	Same seam as `complete`, for the same reason: a tool should not hold a
	provider key or know a provider's wire format. `reference_data_uri` is the
	photo being edited, already base64-encoded by the caller — only the caller can
	read its own Frappe Files.
	"""
	return _client().generate_image(prompt, reference_data_uri=reference_data_uri)


def web_search_support():
	"""Whether this site can reach the public web at all.

	Asked before the tool is offered, so a deployment without web access simply
	does not have the tool rather than having one that always fails — the same
	discipline `image_support()` exists for. `getattr` because a third-party
	client predating this capability is a client that does not have it, not a
	broken one.
	"""
	client = _client()
	probe = getattr(client, "web_search_support", None)
	return bool(probe()) if probe else False


def web_search(query):
	"""One web-grounded answer -> {"answer", "citations"}.

	Same seam as `complete` and `generate_image`, for the same reason: a chat tool
	should not hold a provider key or know which body parameter turns searching
	on. Which model runs the search is the client's business too — it is not the
	model the conversation is using.
	"""
	return _client().web_search(query)


def translate_image(image_url):
	"""One photo with its printed text translated -> {"translated_url"}.

	The URL returned belongs to the provider and may expire; re-hosting it is the
	caller's job. `image_url` must be publicly reachable — the provider fetches it
	itself rather than receiving bytes.
	"""
	return _client().translate_image(image_url)
