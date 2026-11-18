"""A connector's own health check (`health_method` in its registry row).

The method returns a list of checks, each {key, label, state, detail} with state ok, warn, red or
unknown. It runs connector code, so what it returns is validated, what it says is scrubbed, and a
failure becomes one red check that names only the exception class.
"""

from alaiy_os.health.scrub import scrub

STATES = ("ok", "warn", "red", "unknown")


def failed_check(exc):
    return {"key": "health_method", "label": "Custom check", "state": "red",
            "detail": f"The connector's health check failed ({type(exc).__name__})."}


def _bad():
    return [{"key": "health_method", "label": "Custom check", "state": "red",
             "detail": "The connector's health check returned data in an unexpected form."}]


def normalise_checks(result):
    """The checks a connector returned, validated; anything malformed is one red check."""
    if result is None or result == [] or result == ():
        return []
    items = [result] if isinstance(result, dict) else result
    if not isinstance(items, (list, tuple)):
        return _bad()
    out = []
    for item in items:
        if not (isinstance(item, dict) and item.get("key") and item.get("label") and item.get("state") in STATES):
            return _bad()
        out.append({"key": str(item["key"]), "label": str(item["label"]), "state": item["state"],
                    "detail": scrub(item.get("detail"))})
    return out


def connector_state_for(checks):
    """The connector state a set of checks implies: red is failing, warn is a warning, otherwise none."""
    states = {c["state"] for c in checks}
    if "red" in states:
        return "failing"
    if "warn" in states:
        return "warning"
    return None
