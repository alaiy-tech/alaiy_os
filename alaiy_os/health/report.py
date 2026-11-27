"""The JSON other systems read: dashboards, other instances, scripts.

Plain Python and tested. It adds a small envelope (schema, instance, generated_at, overall) to the
collected data, turns datetimes into ISO 8601 strings, and builds a compact summary a dashboard can
poll cheaply. Frappe's own datetime format is never part of this contract.
"""

from datetime import date, datetime, timedelta

from alaiy_os.health.engine import SEVERITY

SCHEMA = 1
STATES = ("healthy", "warning", "failing", "overdue", "stuck", "config_invalid", "no_data", "disabled")
CRITICAL = {"failing", "stuck", "overdue", "config_invalid"}
ATTENTION = CRITICAL | {"warning"}


def jsonable(value, tz=None):
    """Datetimes as ISO 8601 (with the site's offset when `tz` is given), all the way down."""
    if isinstance(value, datetime):
        if tz is not None and value.tzinfo is None:
            value = value.replace(tzinfo=tz)
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: jsonable(item, tz) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(item, tz) for item in value]
    return value


def _functions(collected):
    for connector in collected.get("connectors", []):
        for function in connector.get("functions", []):
            yield connector, function


_CHECK_STATE = {"red": "failing", "warn": "warning"}


def _checks(collected):
    for connector in collected.get("connectors", []):
        for check in connector.get("checks", []):
            yield connector, check


def overall(collected):
    """"critical", "warning" or "ok" for everything collected, platform checks included."""
    states = {function["state"] for _, function in _functions(collected)}
    platform = {check["state"] for check in collected.get("platform", [])}
    platform |= {check["state"] for _, check in _checks(collected)}
    if states & CRITICAL or "red" in platform:
        return "critical"
    if "warning" in states or "warn" in platform:
        return "warning"
    return "ok"


def summary_payload(collected, site, now):
    counts = {state: 0 for state in STATES}
    problems = []
    total = 0
    for connector, function in _functions(collected):
        total += 1
        counts[function["state"]] = counts.get(function["state"], 0) + 1
        if function["state"] in ATTENTION:
            problems.append({
                "connector_id": connector["connector_id"], "connector_name": connector["connector_name"],
                "function_key": function["key"], "function": function["label"], "state": function["state"],
                "reason": function.get("reason", ""), "last_error": function.get("last_error", ""),
                "last_success_at": function.get("last_success_at"), "lag_minutes": function.get("lag_minutes"),
                "consecutive_failures": function.get("consecutive_failures", 0),
            })
    for connector, check in _checks(collected):
        if check["state"] in _CHECK_STATE:
            problems.append({
                "connector_id": connector["connector_id"], "connector_name": connector["connector_name"],
                "function_key": check["key"], "function": check["label"], "state": _CHECK_STATE[check["state"]],
                "reason": check.get("detail", ""), "last_error": "", "last_success_at": None, "lag_minutes": None,
                "consecutive_failures": 0,
            })
    problems.sort(key=lambda p: (SEVERITY.index(p["state"]) if p["state"] in SEVERITY else len(SEVERITY), p["connector_id"]))
    return {
        "schema": SCHEMA, "instance": site, "generated_at": now, "overall": overall(collected),
        "total": total, "attention": len(problems), "counts": counts,
        "platform": [dict(check) for check in collected.get("platform", [])],
        "problems": problems,
        "connectors": [
            {"connector_id": c["connector_id"], "connector_name": c["connector_name"], "state": c["state"],
             "has_contract": c.get("has_contract", False), "functions": len(c.get("functions", [])),
             "checks": len(c.get("checks", []))}
            for c in collected.get("connectors", [])
        ],
    }


def full_payload(collected, site, now):
    return {**collected, "schema": SCHEMA, "instance": site, "generated_at": now, "overall": overall(collected)}


def connector_payload(collected, connector_id, site, now):
    for connector in collected.get("connectors", []):
        if connector["connector_id"] == connector_id:
            return {"schema": SCHEMA, "instance": site, "generated_at": now,
                    "overall": overall({"platform": [], "connectors": [connector]}), "connector": connector}
    raise LookupError(f"No connector '{connector_id}' is registered on this site")


def fresh(collected, now, max_age_seconds):
    """Whether a stored snapshot is recent enough to serve."""
    checked = (collected or {}).get("checked_at")
    return bool(checked) and now - checked <= timedelta(seconds=max_age_seconds)
