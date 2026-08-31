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

optionally, for a caller that wants to show the answer as it is written:

    stream(model, system, messages, tools=None, on_text=None) -> dict

which returns *exactly* the same dict, having called `on_text(chunk)` for each
text delta on the way. Optional, deliberately: this is a published seam, so a
managed client written before streaming existed must keep working. Absence is the
answer — `chat/runner.py` checks with `llm.streaming_available()` and takes the
buffered path when there is no `stream`, the same way `image_support()` reports a
capability without making a call. Never widen `complete` with a streaming
argument instead: an override that does not accept it would raise TypeError on
every turn.

plus two image capabilities, for tools that produce imagery rather than text:

    generate_image(prompt, reference_data_uri=None)
        -> {"b64": str, "media_type": str, "usage": dict}

    translate_image(image_url) -> {"translated_url": str}

and one that reads the public web:

    web_search(query) -> {"answer": str, "citations": [{"title", "url"}]}

Not every client can serve all of them. A client that cannot must raise
`Unsupported` rather than return something empty, so the caller can tell a
deployment that never does this from a provider that happened to fail.
`image_support()` and `web_search_support()` report the same thing without
making a call, for a caller that wants to check up front.

`web_search` is a capability of the *endpoint*, not of the model: it is the
gateway that runs the search and folds the results in. Anthropic direct does not
serve it, which is why the default client below refuses unless `ai_base_url`
points somewhere else. See `chat/websearch.py` for the tool on top, and for the
two mechanisms that look like they work and do not.


The default below is the BYOK (bring-your-own-key) client: it speaks the
Anthropic Messages wire format using a key the customer supplies in
site_config. It is not pinned to api.anthropic.com — set `ai_base_url` to
point the same client at any Anthropic-compatible endpoint: a LiteLLM proxy
(accepts virtual keys via the same x-api-key header), OpenRouter's Anthropic
Skin at https://openrouter.ai/api (an sk-or- key reaches any OpenRouter
model), or providers with native Anthropic-format APIs (DeepSeek, Kimi, GLM).
Managed benches that need more than a base-url swap override the hook with
their own client instead.
"""

import frappe

MAX_TOKENS = 4096

# OpenRouter's own Unified Image API. NOT the OpenAI Images REST API and not
# reachable with the OpenAI SDK — confirmed live, images.generate / images.edit
# both 404 against OpenRouter.
OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images"
DEFAULT_IMAGE_MODEL = "openai/gpt-image-1"
IMAGE_TIMEOUT = 180

# Web search is billed per query on top of tokens, and the search itself is most
# of what the answer is worth — so the cheapest model that supports grounding is
# the right one, whatever the chat is running. Override with `web_search_model`
# in site_config on a gateway whose catalogue differs; `/model_group/info`
# reports `supports_web_search` per model group.
DEFAULT_WEB_SEARCH_MODEL = "gemini-3.1-flash-lite"

# The searcher answers a question; it does not chat. Kept here rather than in the
# tool because both clients send it and a difference between them would show up
# as one deployment citing sources and the other not.
WEB_SEARCH_SYSTEM = (
	"You are a research assistant with live web access. Answer the question from "
	"what you find on the web, not from memory. Name the publication and the date "
	"for every claim. If the sources disagree, say so. If you cannot find an "
	"answer, say that plainly rather than falling back on what you already knew — "
	"an unsourced guess is worse here than no answer."
)


class Unsupported(RuntimeError):
	"""This client cannot serve the requested capability.

	A distinct type so a caller can tell "this deployment doesn't do that" apart
	from "the provider failed" — the first is worth reporting to a human once, the
	second is worth retrying. A plain exception rather than frappe.throw because
	image work runs in worker threads (see the module docstring).
	"""


class ByokClient:
	"""Default client: Anthropic wire format, customer-supplied key.

	site_config keys:
	    ai_api_key    — API key (falls back to legacy `anthropic_api_key`)
	    ai_base_url   — optional; any Anthropic-compatible endpoint, e.g.
	                    https://openrouter.ai/api or a LiteLLM proxy.
	                    Unset = Anthropic direct.
	"""

	def __init__(self):
		# Captured now, on whatever thread built this client, because the image
		# methods below may then be called from worker threads where frappe.conf
		# is not readable. See the module docstring.
		self._image_key = frappe.conf.get("openrouter_api_key")
		self._image_model = frappe.conf.get("image_generate_model") or DEFAULT_IMAGE_MODEL

	def image_support(self):
		"""What this client can do, without making a call."""
		# Translation is a single specialised vendor with its own JWT auth and
		# response contract — not a model API, and not something core carries an
		# integration for. The managed client serves it via the billing service.
		return {"generate": bool(self._image_key), "translate": False}

	def web_search_support(self):
		"""Whether this site can reach the public web, without making a call.

		Only through a proxy. `plugins` is an OpenRouter body parameter that
		LiteLLM and OpenRouter's own Anthropic Skin both forward; api.anthropic.com
		rejects the request as malformed rather than ignoring the key, so a site on
		the SDK default has no web search and must be told so up front rather than
		discovering it as a 400 mid-turn.
		"""
		return bool(frappe.conf.get("ai_base_url"))

	def web_search(self, query):
		"""One web-grounded answer, through whatever proxy `ai_base_url` names.

		Runs as a completion of its own rather than as a flag on the caller's turn:
		the search is a fact-finding errand with its own short prompt, and keeping
		it separate means the chat's own system prompt, tool list and history are
		not re-sent — and re-billed at search rates — to ask what a supplier's
		public price is.

		No citations come back on this route. The Anthropic Messages format has
		nowhere to put the `annotations` array the OpenAI route returns, and the
		gateway drops them rather than inventing a block type, so the sources are
		whatever the model names in its own prose. The managed client overrides
		this with the OpenAI route, which keeps them; see GatewayClient.web_search.
		"""
		import anthropic

		if not self.web_search_support():
			raise Unsupported(
				"This site cannot search the web. Web search needs ai_base_url to "
				"point at a gateway that forwards OpenRouter's `plugins` parameter "
				"(a LiteLLM proxy or OpenRouter's Anthropic Skin); api.anthropic.com "
				"does not serve it."
			)

		api_key = frappe.conf.get("ai_api_key") or frappe.conf.get("anthropic_api_key")
		if not api_key:
			frappe.throw("Set ai_api_key (or anthropic_api_key) in site_config.json before searching the web.")

		client = anthropic.Anthropic(
			api_key=api_key,
			auth_token=api_key,
			base_url=frappe.conf.get("ai_base_url"),
		)
		response = client.messages.create(
			model=frappe.conf.get("web_search_model") or DEFAULT_WEB_SEARCH_MODEL,
			max_tokens=MAX_TOKENS,
			system=WEB_SEARCH_SYSTEM,
			messages=[{"role": "user", "content": query}],
			extra_body={"plugins": [{"id": "web"}]},
		)
		text = "".join(
			block.text for block in response.content if getattr(block, "type", None) == "text"
		)
		return {"answer": text.strip(), "citations": []}

	def _prepare(self, model, system, messages, tools=None):
		"""The provider client and request kwargs, shared by both call paths.

		Factored out so `complete` and `stream` cannot drift: a model, key or
		header that works buffered must work streamed, or the flag that chooses
		between them stops being a safe thing to flip.
		"""
		import anthropic

		api_key = frappe.conf.get("ai_api_key") or frappe.conf.get("anthropic_api_key")
		if not api_key:
			frappe.throw("Set ai_api_key (or anthropic_api_key) in site_config.json before running agents.")

		# api_key goes out as `x-api-key` (Anthropic, LiteLLM); auth_token as
		# `Authorization: Bearer` (OpenRouter's Anthropic-compatible endpoint).
		# Sending both lets one config key work everywhere — each provider
		# reads its own header and ignores the other.
		client = anthropic.Anthropic(
			api_key=api_key,
			auth_token=api_key,
			base_url=frappe.conf.get("ai_base_url"),  # None = SDK default (api.anthropic.com)
		)
		kwargs = {
			"model": model,
			"max_tokens": MAX_TOKENS,
			"system": system,
			"messages": messages,
		}
		if tools:
			kwargs["tools"] = tools
		return client, kwargs

	def _result(self, response):
		"""One provider Message in the shape every caller consumes."""
		return {
			"content": [block.model_dump() for block in response.content],
			"stop_reason": response.stop_reason,
			"usage": {
				"input_tokens": response.usage.input_tokens,
				"output_tokens": response.usage.output_tokens,
			},
		}

	def complete(self, model, system, messages, tools=None):
		client, kwargs = self._prepare(model, system, messages, tools=tools)
		return self._result(client.messages.create(**kwargs))

	def stream(self, model, system, messages, tools=None, on_text=None):
		"""Same call, same return value, with text handed over as it arrives.

		`on_text` sees only `text_delta`s — not tool arguments, which are useless
		half-written, and not thinking. The return value comes from
		`get_final_message()`, the SDK's own accumulation of the stream, so
		tool_use blocks, `stop_reason` and `usage` are exactly what the buffered
		path would have produced and no caller has to know which one ran.
		"""
		client, kwargs = self._prepare(model, system, messages, tools=tools)
		with client.messages.stream(**kwargs) as stream:
			for event in stream:
				if event.type != "content_block_delta" or event.delta.type != "text_delta":
					continue
				if on_text:
					on_text(event.delta.text)
			return self._result(stream.get_final_message())

	def generate_image(self, prompt, reference_data_uri=None):
		"""One image, via OpenRouter's Unified Image API on the site's own key.

		site_config keys:
		    openrouter_api_key   — an sk-or- key
		    image_generate_model — optional; defaults to openai/gpt-image-1

		A separate key from `ai_api_key` on purpose: the image API is OpenRouter's
		own endpoint, so a site pointing `ai_base_url` at some other
		Anthropic-compatible provider still needs an OpenRouter key to reach it.

		Thread-safe: reads only state captured in __init__.
		"""
		import requests

		if not self._image_key:
			raise Unsupported(
				"This site cannot generate images. Set openrouter_api_key in "
				"site_config.json, or install alaiy_os_ai_client to use the managed "
				"image service."
			)

		payload = {
			"model": self._image_model,
			"prompt": prompt,
			"n": 1,
			"output_format": "png",
		}
		if reference_data_uri:
			payload["input_references"] = [
				{"type": "image_url", "image_url": {"url": reference_data_uri}}
			]

		resp = requests.post(
			OPENROUTER_IMAGES_URL,
			headers={"Authorization": f"Bearer {self._image_key}"},
			json=payload,
			timeout=IMAGE_TIMEOUT,
		)
		if resp.status_code != 200:
			raise RuntimeError(
				f"Image generation failed ({resp.status_code}): {resp.text[:500]}"
			)

		data = resp.json()
		image = data["data"][0]
		return {
			"b64": image["b64_json"],
			"media_type": image.get("media_type", "image/png"),
			"usage": data.get("usage", {}),
		}

	def translate_image(self, image_url):
		"""Not available on BYOK — see image_support()."""
		raise Unsupported(
			"This site cannot translate images. Install alaiy_os_ai_client, which "
			"serves image translation through the managed billing service."
		)


def get_ai_client():
	"""Default factory registered on the `ai_client` hook."""
	return ByokClient()
