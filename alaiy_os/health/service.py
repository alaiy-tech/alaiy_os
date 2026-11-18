"""Collect the health of every registered connector, store it, and report what changed.

Readers are injected so the collection logic runs without a bench. The defaults read the registry,
the connector's settings document and its own log. One connector, or one function, that cannot be
read never hides the others: it shows as a configuration problem with a generic reason.
"""

from alaiy_os.health.changes import diff
from alaiy_os.health.contract import normalise_health
from alaiy_os.health.engine import INVALID, SEVERITY, compute_state
from alaiy_os.health.runs import read_runs
from alaiy_os.health.scrub import scrub

NO_CONTRACT = "no_contract"
UNREADABLE_INTERVAL = "?"  # parses as invalid, so unreadable settings never read as disabled


def _problem(key, label, reason):
    return {"key": key, "label": label, "state": INVALID, "reason": reason, "last_error": ""}


def _function(row, entry, now, runs_reader, interval_reader):
    try:
        runs = runs_reader(entry)
        raw = None
        if entry.get("scheduled", True):
            try:
                raw = interval_reader(row, entry)
            except Exception:
                raw = UNREADABLE_INTERVAL
        result = compute_state(entry, runs, now, interval_raw=raw, connector_enabled=bool(row.get("is_enabled")))
        result["last_error"] = scrub(result.get("last_error"))
        return result
    except Exception as exc:
        return _problem(entry["key"], entry.get("label"), f"The log could not be read ({type(exc).__name__})")


def _connector(row, now, runs_reader, interval_reader):
    base = {"connector_id": row["connector_id"], "connector_name": row.get("connector_name") or row["connector_id"]}
    try:
        entries = normalise_health(row.get("health"))
    except ValueError:
        return {**base, "has_contract": True, "state": INVALID,
                "functions": [_problem("health", "Health list", "The connector's health list is not valid")]}
    if not entries:
        return {**base, "has_contract": False, "state": NO_CONTRACT, "functions": []}
    functions = [_function(row, e, now, runs_reader, interval_reader) for e in entries]
    state = min((f["state"] for f in functions), key=SEVERITY.index)
    return {**base, "has_contract": True, "state": state, "functions": functions}


def collect(now, *, rows=None, runs_reader=None, interval_reader=None):
    """Return {"checked_at", "platform", "connectors"}. Platform checks are added by `run_checks`."""
    rows = _registry_rows() if rows is None else rows
    runs_reader = runs_reader or read_runs
    interval_reader = interval_reader or _read_interval
    return {
        "checked_at": now,
        "platform": [],
        "connectors": [_connector(r, now, runs_reader, interval_reader) for r in rows],
    }


def flatten(collected):
    """One entry per function and per platform check, keyed for `changes.diff`."""
    flat = {}
    for connector in collected["connectors"]:
        for function in connector["functions"]:
            flat[f"{connector['connector_id']}::{function['key']}"] = {
                "state": function["state"], "reason": function.get("reason", "")}
    for check in collected["platform"]:
        flat[f"platform::{check['key']}"] = {"state": check["state"], "reason": check.get("detail", "")}
    return flat


# ── Frappe-facing defaults ───────────────────────────────────────────────────

def _registry_rows():
    import frappe

    if not frappe.db.exists("DocType", "OS Connector Registry"):
        return []
    return frappe.get_all(
        "OS Connector Registry",
        fields=["connector_id", "connector_name", "is_enabled", "health"],
        order_by="connector_name asc",
        limit=500,
    )


def _read_interval(row, entry):
    """The raw interval setting from the connector's own settings document."""
    import frappe
    from alaiy_os.api.connectors import _settings_doc

    registry = frappe.get_doc("OS Connector Registry", row["connector_id"])
    return _settings_doc(registry).get(entry["interval_setting"])


def load_previous():
    import frappe

    rows = frappe.get_all("OS Connector Health State", fields=["state_key", "state"], limit=5000)
    return {r["state_key"]: {"state": r["state"]} for r in rows}


def save_states(flat, now):
    """Upsert one row per key; `since` moves only when the state changes."""
    import frappe

    existing = {r["state_key"]: r for r in frappe.get_all(
        "OS Connector Health State", fields=["name", "state_key", "state"], limit=5000)}
    for key, entry in flat.items():
        connector_id, _, function_key = key.partition("::")
        values = {"state": entry["state"], "reason": scrub(entry.get("reason")), "last_checked": now}
        row = existing.get(key)
        if row is None:
            frappe.get_doc({"doctype": "OS Connector Health State", "state_key": key, "connector_id": connector_id,
                            "function_key": function_key, "since": now, **values}).insert(ignore_permissions=True)
        else:
            if row["state"] != entry["state"]:
                values["since"] = now
            frappe.db.set_value("OS Connector Health State", row["name"], values, update_modified=False)


def run_checks():
    """The 5-minute job: collect, store, and send what changed. Never raises into the scheduler."""
    import frappe
    from frappe.utils import now_datetime

    from alaiy_os.health import alerts
    from alaiy_os.health.platform import run_platform_checks

    now = now_datetime()
    collected = collect(now)
    collected["platform"] = run_platform_checks(now)
    flat = flatten(collected)
    changes = diff(load_previous(), flat, now)
    save_states(flat, now)
    frappe.db.commit()
    alerts.notify(changes, collected)
    return changes
