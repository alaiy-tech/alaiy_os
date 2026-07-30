# How AI calls work

Every agent call goes through one function: `llm.complete()`. It doesn't talk
to any AI provider itself — it asks Frappe's `ai_client` hook for a client and
hands the request to it. Whichever app registered that hook last wins.

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

## With the ai_client app (managed)

Installing `alaiy_os_ai_client` re-registers the hook, so its gateway client
takes over automatically. On install it asks the billing service for a
per-site key to the managed LiteLLM proxy and writes it into site config
itself — nothing to configure. Requests then route through the proxy, which
handles any model provider, tracks per-site spend, enforces budgets, and
shows a "top up" message when credits run out.

## The contract

Either way, agents and the executor never change — the only thing that moves
is which client sits behind the hook. A client is any object exposing:

```python
complete(model, system, messages, tools=None) -> {
    "content": [<Anthropic-format block dict>, ...],
    "stop_reason": str,
    "usage": {"input_tokens": int, "output_tokens": int},
}
```
