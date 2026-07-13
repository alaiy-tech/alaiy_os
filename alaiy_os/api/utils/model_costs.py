import json
from pathlib import Path

_config = json.loads((Path(__file__).parent / "model_costs.json").read_text())

BASE_UNIT_USD: float = _config["_meta"]["base_unit_usd"]
MARKUP: int = _config["_meta"]["markup"]

_MODEL_COSTS: dict = {
    model: ops
    for provider in _config
    if not provider.startswith("_")
    for model, ops in _config[provider].items()
}


def _usd_to_tokens(usd: float) -> int:
    return max(1, round((usd * MARKUP) / BASE_UNIT_USD))


def get_token_cost(
    model: str,
    operation: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    quantity: float = 1.0,
) -> int:
    """
    Returns internal tokens to charge for an AI operation.

    For text_gen: pass input_tokens and output_tokens from the actual API response.
    For image_gen: pass quantity = number of images generated.

    Args:
        model:         API model ID, e.g. "gemini-2.5-pro"
        operation:     "text_gen" | "image_gen"
        input_tokens:  Input token count  (text_gen only)
        output_tokens: Output token count (text_gen only)
        quantity:      Image count        (image_gen only)

    Returns:
        Internal token count (always >= 1).

    Raises:
        ValueError: unknown model or operation.

    Examples:
        cost = get_token_cost("claude-opus-4-8", "text_gen",
                              input_tokens=500, output_tokens=300)
        cost = get_token_cost("gemini-2.5-flash-image", "image_gen", quantity=2)
    """
    ops = _MODEL_COSTS.get(model)
    if ops is None:
        raise ValueError(f"Unknown model: '{model}'")

    spec = ops.get(operation)
    if spec is None:
        raise ValueError(f"Model '{model}' does not support operation '{operation}'")

    if operation == "text_gen":
        if "tiers" in spec:
            total_tokens = input_tokens + output_tokens
            tier = next(
                t for t in spec["tiers"]
                if t["max_tokens"] is None or total_tokens <= t["max_tokens"]
            )
        else:
            tier = spec
        usd = (
            tier["input_usd_per_1m"] * input_tokens / 1_000_000
            + tier["output_usd_per_1m"] * output_tokens / 1_000_000
        )
    elif operation == "image_gen":
        usd = spec["usd_per_image"] * quantity
    else:
        raise ValueError(f"Unsupported operation type: '{operation}'")

    return _usd_to_tokens(usd)
