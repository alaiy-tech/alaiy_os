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

plus two image capabilities, for tools that produce imagery rather than text:

    generate_image(prompt, reference_data_uri=None)
        -> {"b64": str, "media_type": str, "usage": dict}

    translate_image(image_url) -> {"translated_url": str}

Not every client can serve both. A client that cannot must raise `Unsupported`
rather than return something empty, so the caller can tell a deployment that
never does this from a provider that happened to fail. `image_support()` reports
the same thing without making a call, for a caller that wants to check up front.


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

	def complete(self, model, system, messages, tools=None):
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

		response = client.messages.create(**kwargs)
		return {
			"content": [block.model_dump() for block in response.content],
			"stop_reason": response.stop_reason,
			"usage": {
				"input_tokens": response.usage.input_tokens,
				"output_tokens": response.usage.output_tokens,
			},
		}

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
