# How AI calls work

Every AI call goes through `alaiy_os.engine.llm` — `complete()` for text, plus
`generate_image()` and `translate_image()` for imagery. None of them talk to a
provider themselves: each asks Frappe's `ai_client` hook for a client and hands
the request to it. Whichever app registered that hook last wins.

No app outside this seam should hold a provider credential or make a provider
HTTP call. That is the whole point of it.

## Without the ai_client app (BYOK)

Core's default client (`ai_client.py` in this directory) runs. Put your own
key in site config and you're done:

```json
"ai_api_key": "sk-...",
"ai_base_url": "https://openrouter.ai/api"
```

`ai_base_url` is optional — leaving it unset means Anthropic directly. Set it
to point the same client at any Anthropic-compatible endpoint instead

The legacy `anthropic_api_key` config key still works as a fallback.

For image generation, add your own OpenRouter key:

```json
"openrouter_api_key": "sk-or-...",
"image_generate_model": "openai/gpt-image-1"
```

`image_generate_model` is optional. A separate key from `ai_api_key` because the
image API is OpenRouter's own endpoint, so a site pointing `ai_base_url`
elsewhere still needs this to reach it.

Image *translation* is not available on BYOK — it is a single specialised vendor
rather than a model API, and core carries no integration for it. `image_support()`
reports `{"generate": ..., "translate": False}` and the method raises
`Unsupported`.

## With the ai_client app (managed)

Installing `alaiy_os_ai_client` re-registers the hook, so its gateway client
takes over automatically. On install it asks the billing service for a
per-site key to the managed LiteLLM proxy and writes it into site config
itself — nothing to configure. Requests then route through the proxy, which
tracks per-site spend, enforces budgets, and shows a "top up" message when
credits run out.

Image calls take a different route to the same balance: the managed client posts
to the billing service's `/image/generate` and `/image/translate`, which hold the
provider keys and charge each call against the same per-site budget.

They go there rather than through the gateway because of translation — that
vendor is not an LLM (no model id, its own auth and response contract), so no
gateway can front it whatever the model catalogue carries. Billing has to serve
it either way, and generation sits beside it so both share one credential holder
and one metering path.

Callers never see the difference, and are not affected if it changes: routing
lives entirely behind the seam.

## The contract

Either way, agents and the executor never change — the only thing that moves
is which client sits behind the hook. A client is any object exposing:

```python
complete(model, system, messages, tools=None) -> {
    "content": [<Anthropic-format block dict>, ...],
    "stop_reason": str,
    "usage": {"input_tokens": int, "output_tokens": int},
}

generate_image(prompt, reference_data_uri=None) -> {
    "b64": str, "media_type": str, "usage": dict,
}

translate_image(image_url) -> {"translated_url": str}

image_support() -> {"generate": bool, "translate": bool}
```

A client that cannot serve a capability raises `Unsupported` (exported from
`llm`) rather than returning something empty, so a caller can tell "this
deployment doesn't do that" from "the provider failed". `image_support()` reports
the same thing without making a call, for an up-front check.

### Threading

The image methods must be safe to call from a worker thread — callers render
images in parallel, and a worker thread has no Frappe request context, so
`frappe.conf` raises there. A client therefore reads its image configuration in
`__init__` and its image methods touch nothing but that captured state.

Resolve the client on the main thread with `llm.image_client()`, then hand the
instance to the pool:

```python
client = llm.image_client()          # main thread: hook + site config
with ThreadPoolExecutor(...) as pool:
    pool.map(lambda s: client.generate_image(s), shots)
```

`llm.generate_image()` / `llm.translate_image()` are the convenience path for a
single call on the current thread.
