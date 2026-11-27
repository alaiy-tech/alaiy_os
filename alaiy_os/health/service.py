"""Collect the health of every registered connector, store it, and report what changed.

Readers are injected so the collection logic runs without a bench. The defaults read the registry,
the connector's settings document and its own log. One connector, or one function, that cannot be
read never hides the others: it shows as a configuration problem with a generic reason.
"""

from types import SimpleNamespace

from alaiy_os.health.changes import diff
from alaiy_os.health.checks import connector_state_for, failed_check, normalise_checks
from alaiy_os.health.contract import normalise_health
from alaiy_os.health.engine import HEALTHY, INVALID, SEVERITY, compute_request_state, compute_state
from alaiy_os.health.runs import read_requests, read_runs
from alaiy_os.health.scrub import scrub

NO_CONTRACT = "no_contract"
CACHE_KEY = "alaiy_health_snapshot"  # the latest snapshot, kept warm by the 5-minute job for dashboards
CACHE_SECONDS = 900
UNREADABLE_INTERVAL = "?"  # parses as invalid, so unreadable settings never read as disabled


def _problem(key, label, reason):
    return {"key": key, "label": label, "state": INVALID, "reason": reason, "last_error": ""}


def _operation_labels(row):
    """Button labels for the sync operations the connector registered, as the registry names them."""
    labels = []
    for method, label, fallback in (("sync_categories_method", "sync_categories_label", "categories"),
                                    ("sync_items_method", "sync_items_label", "items")):
        if row.get(method):
            labels.append((row.get(label) or fallback).strip())
    return labels


def _function(row, entry, now, readers):
    try:
        if entry.get("kind") == "requests":
            rows, last_ok, last_error = readers.requests(entry, now)
            result = compute_request_state(entry, rows, now, last_success_at=last_ok, last_error=last_error,
                                           connector_enabled=bool(row.get("is_enabled")))
        else:
            runs = readers.runs(entry)
            enabled = True
            if entry.get("enabled_setting"):
                try:
                    enabled = bool(readers.switch(row, entry))
                except Exception:
                    return _problem(entry["key"], entry.get("label"), "The connector's settings could not be read")
            raw = None
            if entry.get("scheduled", True):
                try:
                    raw = readers.interval(row, entry)
                except Exception:
                    raw = UNREADABLE_INTERVAL
            result = compute_state(entry, runs, now, interval_raw=raw, connector_enabled=bool(row.get("is_enabled")),
                                   function_enabled=enabled)
        result["last_error"] = scrub(result.get("last_error"))
        result["log_doctype"] = entry["log_doctype"]
        result["log_filter"] = entry.get("log_filter") or {}
        return result
    except Exception as exc:
        return _problem(entry["key"], entry.get("label"), f"The log could not be read ({type(exc).__name__})")


def _checks_of(row, readers):
    """The connector's own checks: validated, and never allowed to break the connector."""
    if not (row.get("health_method") and row.get("is_enabled")):
        return []
    try:
        return normalise_checks(readers.checks(row))
    except Exception as exc:
        return [failed_check(exc)]


def _connector(row, now, readers):
    base = {"connector_id": row["connector_id"], "connector_name": row.get("connector_name") or row["connector_id"],
            "operations": _operation_labels(row), "can_test": bool(row.get("test_method"))}
    try:
        entries = normalise_health(row.get("health"))
    except ValueError:
        return {**base, "has_contract": True, "state": INVALID, "checks": [],
                "functions": [_problem("health", "Health list", "The connector's health list is not valid")]}
    checks = _checks_of(row, readers)
    if not entries and not checks:
        return {**base, "has_contract": False, "state": NO_CONTRACT, "functions": [], "checks": []}
    functions = [_function(row, e, now, readers) for e in entries]
    states = [f["state"] for f in functions]
    implied = connector_state_for(checks)
    if implied:
        states.append(implied)
    state = min(states, key=SEVERITY.index) if states else HEALTHY
    return {**base, "has_contract": True, "state": state, "functions": functions, "checks": checks}


def collect(now, *, rows=None, runs_reader=None, interval_reader=None, switch_reader=None,
            requests_reader=None, checks_reader=None):
    """Return {"checked_at", "platform", "connectors"}. Platform checks are added by `run_checks`."""
    rows = _registry_rows() if rows is None else rows
    readers = SimpleNamespace(
        runs=runs_reader or read_runs, interval=interval_reader or _read_interval, switch=switch_reader or _read_switch,
        requests=requests_reader or read_requests, checks=checks_reader or _read_checks)
    return {
        "checked_at": now,
        "platform": [],
        "connectors": [_connector(r, now, readers) for r in rows],
    }


def pick_operation(operations, requested):
    """The dotted path of a sync operation the registry declares. Never a path the caller supplies."""
    key = str(requested or "").strip().lower()
    if not key or key not in operations:
        raise ValueError("That operation is not one this connector declares")
    return operations[key]


def flags_for(changes, previous, now):
    """The announced/last-announced flags to store, after the changes of this run."""
    flags = {k: {"alerted": bool(v.get("alerted")), "alerted_at": v.get("alerted_at")} for k, v in previous.items()}
    for change in changes:
        before = flags.get(change["key"], {"alerted_at": None})
        if change["kind"] == "alert":
            flags[change["key"]] = {"alerted": True, "alerted_at": now}
        else:
            flags[change["key"]] = {"alerted": False, "alerted_at": before["alerted_at"]}
    return flags


def flatten(collected):
    """One entry per function and per platform check, keyed for `changes.diff`."""
    flat = {}
    for connector in collected["connectors"]:
        for function in connector["functions"]:
            flat[f"{connector['connector_id']}::{function['key']}"] = {
                "state": function["state"], "reason": function.get("reason", "")}
        for check in connector.get("checks", []):
            flat[f"check::{connector['connector_id']}::{check['key']}"] = {"state": check["state"], "reason": check.get("detail", "")}
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
        fields=["connector_id", "connector_name", "is_enabled", "health", "health_method", "test_method",
                "sync_categories_method", "sync_categories_label", "sync_items_method", "sync_items_label"],
        order_by="connector_name asc",
        limit=500,
    )


def settings_value(doc, fieldname):
    """A field of the connector's settings document. A record that was never saved carries only
    field defaults, which would read as "disabled", so it is unreadable instead."""
    if doc.is_new() or not doc.get("modified"):
        raise LookupError("The settings record has never been saved")
    return doc.get(fieldname)


def _settings(row):
    import frappe
    from alaiy_os.api.connectors import _settings_doc

    return _settings_doc(frappe.get_doc("OS Connector Registry", row["connector_id"]))


def _read_interval(row, entry):
    """The raw interval setting from the connector's own settings document."""
    return settings_value(_settings(row), entry["interval_setting"])


def _read_switch(row, entry):
    """Whether the function's own on/off switch is on, from the connector's settings document."""
    return settings_value(_settings(row), entry["enabled_setting"])


CHECK_OK_SECONDS = 1800      # a connector's own check is not re-run more often than this
CHECK_FAILED_SECONDS = 300   # and a failing one is retried sooner, but not on every page load


def _read_checks(row):
    """Run the connector's health_method, remembering the answer so a check that calls a remote API is not
    run on every page load. Returns the validated checks; a failure is cached too, as a red check."""
    import frappe

    key = f"alaiy_health_check:{row['connector_id']}"
    cached = frappe.cache.get_value(key)
    if cached is not None:
        return cached
    try:
        checks = normalise_checks(frappe.get_attr(row["health_method"])())
        ttl = CHECK_OK_SECONDS
    except Exception as exc:
        checks, ttl = [failed_check(exc)], CHECK_FAILED_SECONDS
    frappe.cache.set_value(key, checks, expires_in_sec=ttl)
    return checks


def load_previous():
    import frappe

    rows = frappe.get_all("OS Connector Health State", fields=["state_key", "state", "alerted", "alerted_at"], limit=5000)
    return {r["state_key"]: {"state": r["state"], "alerted": bool(r["alerted"]), "alerted_at": r["alerted_at"]} for r in rows}


def save_states(flat, now, flags=None):
    """Upsert one row per key; `since` moves only when the state changes."""
    import frappe

    existing = {r["state_key"]: r for r in frappe.get_all(
        "OS Connector Health State", fields=["name", "state_key", "state"], limit=5000)}
    for key, entry in flat.items():
        connector_id, _, function_key = key.partition("::")
        flag = (flags or {}).get(key) or {"alerted": False, "alerted_at": None}
        values = {"state": entry["state"], "reason": scrub(entry.get("reason")), "last_checked": now,
                  "alerted": 1 if flag["alerted"] else 0, "alerted_at": flag["alerted_at"]}
        row = existing.get(key)
        if row is None:
            frappe.get_doc({"doctype": "OS Connector Health State", "state_key": key, "connector_id": connector_id,
                            "function_key": function_key, "since": now, **values}).insert(ignore_permissions=True)
        else:
            if row["state"] != entry["state"]:
                values["since"] = now
            frappe.db.set_value("OS Connector Health State", row["name"], values, update_modified=False)


def snapshot(now):
    """Connector states plus platform checks: what the page, the API and the jobs all use."""
    from alaiy_os.health.platform import run_platform_checks

    collected = collect(now)
    collected["platform"] = run_platform_checks(now)
    return collected


def send_digest():
    """The daily digest of anything not healthy. Silent when everything is fine."""
    from frappe.utils import now_datetime

    from alaiy_os.health import alerts

    config = alerts.alert_config()
    if not (config["enabled"] and config["digest"]):
        return
    collected = snapshot(now_datetime())
    text = alerts.digest_message(alerts._site(), collected)
    webhook = config["webhook"]
    if text and webhook:
        try:
            alerts._post(webhook, text)
        except Exception as exc:
            alerts._log(f"The connector health digest could not be sent ({type(exc).__name__})")


def run_checks():
    """The 5-minute job: collect, store, and send what changed."""
    import frappe
    from frappe.utils import now_datetime

    from alaiy_os.health import alerts

    now = now_datetime()
    collected = snapshot(now)
    frappe.cache.set_value(CACHE_KEY, collected, expires_in_sec=CACHE_SECONDS)
    flat = flatten(collected)
    previous = load_previous()
    changes = diff(previous, flat, now, cooldown_min=alerts.alert_config()["cooldown_min"])
    save_states(flat, now, flags_for(changes, previous, now))
    frappe.db.commit()
    alerts.notify(changes, collected)
    return changes
