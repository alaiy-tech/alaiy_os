"""When does a state change deserve a message?

Once on the move into a bad state, once on recovery, and nothing while the state stays the same.
Keys are "connector::function" for connector functions and "platform::check" for platform checks.
"""

from alaiy_os.health.engine import ALERT_STATES, HEALTHY, WARNING


def _alerting(key, state):
    return state == "red" if key.startswith("platform::") else state in ALERT_STATES


def _recovered(key, state):
    return state in ("ok", "warn") if key.startswith("platform::") else state in (HEALTHY, WARNING)


def diff(previous, current, now):
    """Return [{key, old, new, kind}] for the states that changed; kind is "alert" or "recovery"."""
    changes = []
    for key, entry in current.items():
        new = entry["state"]
        old = (previous.get(key) or {}).get("state")
        if new == old:
            continue
        if _alerting(key, new):
            kind = "alert"
        elif old is not None and _alerting(key, old) and _recovered(key, new):
            kind = "recovery"
        else:
            continue
        changes.append({"key": key, "old": old, "new": new, "kind": kind, "at": now})
    return changes
