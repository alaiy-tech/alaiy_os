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


def streaming_available():
	"""Whether the active client can stream — without making a call.

	`stream` is optional on the client contract (see `engine/ai_client.py`), so a
	managed client predating it is missing the method rather than failing on it.
	A caller checks once up front and picks a path, the same way `image_support()`
	is read before queueing image work.
	"""
	return hasattr(_client(), "stream")


def stream(model, system, messages, tools=None, on_text=None):
	"""`complete`, with each text delta handed to `on_text` as it arrives.

	Returns the same dict `complete` does — the caller's handling of blocks,
	`stop_reason` and usage is identical either way. Raises `Unsupported` rather
	than silently buffering if this deployment's client cannot stream, so a caller
	that asked for it learns that it did not happen.
	"""
	client = _client()
	if not hasattr(client, "stream"):
		raise Unsupported("This deployment's ai_client cannot stream responses.")
	return client.stream(model, system, messages, tools=tools, on_text=on_text)


def generate_image(prompt, reference_data_uri=None):
	"""One generated image -> {"b64", "media_type", "usage"}.

	Same seam as `complete`, for the same reason: a tool should not hold a
	provider key or know a provider's wire format. `reference_data_uri` is the
	photo being edited, already base64-encoded by the caller — only the caller can
	read its own Frappe Files.
	"""
	return _client().generate_image(prompt, reference_data_uri=reference_data_uri)


def remove_background(
	image_data_uri,
	*,
	background_color=None,
	background_prompt=None,
	shadow="soft",
	shadow_intensity=None,
	output_size=None,
	padding=None,
	padding_sides=None,
):
	"""One photo, matted and optionally given a new background ->
	{"b64", "media_type"}.

	Same seam as `generate_image`: a tool should not hold a provider key or
	know a provider's wire format. At most one of `background_color` (a
	`#rrggbb` hex — the house finish) or `background_prompt` (free text — a
	generated lifestyle background); neither means a transparent cutout.
	Either way the product's own pixels are kept and only the background is
	touched. `shadow` is "soft" | "hard" | "none"; `shadow_intensity` (0..1)
	optionally lightens or darkens it. `output_size` / `padding` /
	`padding_sides` follow Photoroom's own syntax (see `engine/ai_client.py`)
	since this call is currently Photoroom-specific; they are simply ignored
	by a client that doesn't need them.

	Raises `Unsupported` if this deployment's client has no background/matting
	provider configured.
	"""
	return _client().remove_background(
		image_data_uri,
		background_color=background_color,
		background_prompt=background_prompt,
		shadow=shadow,
		shadow_intensity=shadow_intensity,
		output_size=output_size,
		padding=padding,
		padding_sides=padding_sides,
	)


def virtual_model(image_data_uri, *, model_preset=None, scene_preset=None, pose=None, prompt=None, size=None):
	"""One photo, shown worn by a generated person -> {"b64", "media_type"}.

	Same seam as `remove_background`, with a DIFFERENT guarantee: this is the
	one image capability on this seam that does NOT promise the product's own
	pixels survive untouched — showing something worn means generating the
	scene around it, and Photoroom's own model may reinterpret the product in
	the process. Treat the result as a styled/marketing render, never as a
	stand-in for the authoritative product photo a customer is buying.

	All of `model_preset` / `scene_preset` / `pose` / `size` are optional and
	follow Photoroom's own preset names (see `engine/ai_client.py`); `prompt`
	is free text, e.g. "street style". Leaving everything unset asks Photoroom
	to choose automatically.

	Raises `Unsupported` if this deployment's client has no provider for it.
	"""
	return _client().virtual_model(
		image_data_uri,
		model_preset=model_preset,
		scene_preset=scene_preset,
		pose=pose,
		prompt=prompt,
		size=size,
	)


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


def transcribe_support():
	"""Whether this site can transcribe voice input at all.

	Asked before the mic button is wired up live, the same discipline
	`image_support()` exists for — a deployment without a transcription
	provider simply has no working mic rather than one that always fails.
	`getattr` because a third-party client predating this capability is a
	client that does not have it, not a broken one.
	"""
	client = _client()
	probe = getattr(client, "transcribe_support", None)
	return bool(probe()) if probe else False


def transcribe_audio(audio_bytes, mime_type):
	"""One recorded clip, transcribed -> {"text": str}.

	Same seam as `generate_image`: a chat endpoint should not hold a provider
	key or know Whisper's wire format. Raises `Unsupported` if this
	deployment's client cannot serve it.
	"""
	client = _client()
	if not hasattr(client, "transcribe_audio"):
		raise Unsupported("This deployment's ai_client cannot transcribe audio.")
	return client.transcribe_audio(audio_bytes, mime_type)
