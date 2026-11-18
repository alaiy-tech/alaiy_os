"""When does a state change deserve a message?

A problem is announced once, when it starts; moving between bad states is the same problem. A
recovery is sent once, and only for a problem that was announced. A function that flaps is not
announced again inside the cooldown, and a problem that outlasts the cooldown is announced then.
Keys are "connector::function" for connector functions and "platform::check" for platform checks.
Each previous entry carries `state`, `alerted` (an alert is outstanding) and `alerted_at`.
"""

from datetime import timedelta

from alaiy_os.health.engine import ALERT_STATES, HEALTHY, WARNING

COOLDOWN_MIN = 60
CHECK_PREFIXES = ("platform::", "check::")  # states ok / warn / red, not the function states


def _alerting(key, state):
    return state == "red" if key.startswith(CHECK_PREFIXES) else state in ALERT_STATES


def _recovered(key, state):
    return state in ("ok", "warn") if key.startswith(CHECK_PREFIXES) else state in (HEALTHY, WARNING)


def diff(previous, current, now, cooldown_min=COOLDOWN_MIN):
    """Return [{key, old, new, kind, at}]; kind is "alert" or "recovery"."""
    changes = []
    for key, entry in current.items():
        new = entry["state"]
        before = previous.get(key) or {}
        announced = bool(before.get("alerted"))
        if _alerting(key, new):
            if announced:
                continue
            last = before.get("alerted_at")
            if last and now - last < timedelta(minutes=cooldown_min):
                continue
            kind = "alert"
        elif announced and _recovered(key, new):
            kind = "recovery"
        else:
            continue
        changes.append({"key": key, "old": before.get("state"), "new": new, "kind": kind, "at": now})
    return changes
