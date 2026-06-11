import json
import os

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "connector_config.json")
_cache = None


def get_connector_config() -> dict:
    """Load connector_config.json once and cache in memory."""
    global _cache
    if _cache is None:
        with open(_CONFIG_PATH, "r") as f:
            _cache = json.load(f)
    return _cache


def get_connectors() -> dict:
    return get_connector_config().get("connectors", {})


def is_connector_enabled(connector_name: str) -> bool:
    return get_connectors().get(connector_name, {}).get("enabled", False)


def get_connector_settings(connector_name: str) -> dict:
    return get_connectors().get(connector_name, {})


def get_company_config() -> dict:
    return get_connector_config().get("company", {})
