"""Try Connector Health on a build site by writing synthetic runs into a connector's own log.

Never for a client site: it inserts rows and can change an interval setting. It refuses to run
unless the site config has `health_simulation_allowed` set, which only a build site should have.

    bench --site SITE set-config health_simulation_allowed 1
    bench --site SITE execute alaiy_os.health.simulate.run --kwargs "{'scenario': 'overdue'}"
    bench --site SITE execute alaiy_os.health.simulate.cleanup

`build_rows`, `log_values` and the scenario table are plain Python and tested; the rest touches
Frappe and has not been run on a bench.
"""

import json
from datetime import timedelta

from alaiy_os.health.contract import STANDARD_FIELDS

# scenario -> the state the engine must give it
EXPECTED = {
    "healthy": "healthy",
    "overdue": "overdue",
    "failing_all_items": "failing",
    "failing_runs": "failing",
    "zero_rows": "warning",
    "skipped_rows": "warning",
    "stuck": "stuck",
}
SCENARIOS = tuple(EXPECTED)


def _row(now, minutes_ago, status="success", processed=10, failed=0, skipped=0, error="", running=False):
    start = now - timedelta(minutes=minutes_ago)
    return {
        "status": status, "started_at": start, "finished_at": None if running else start + timedelta(minutes=1),
        "processed": processed, "changed": max(processed - failed, 0), "failed": failed, "skipped": skipped,
        "error": error,
    }


def build_rows(scenario, interval_minutes, now):
    """Synthetic run records for a scenario, newest first."""
    step = max(interval_minutes, 5)
    if scenario == "healthy":
        return [_row(now, 5)]
    if scenario == "overdue":
        return [_row(now, max(3 * interval_minutes, 15) + 30)]
    if scenario == "failing_all_items":
        return [_row(now, 5, processed=20, failed=20)]
    if scenario == "failing_runs":
        return [_row(now, 5 + i * step, status="failed", processed=0, error="401 Unauthorized token=abc123secret")
                for i in range(3)]
    if scenario == "zero_rows":
        return [_row(now, 5 + i * step, processed=0) for i in range(3)]
    if scenario == "skipped_rows":
        return [_row(now, 5, processed=10, skipped=3)]
    if scenario == "stuck":
        return [_row(now, 90, status="running", running=True), _row(now, 200)]
    raise ValueError(f"Unknown scenario '{scenario}'. Choose one of: {', '.join(SCENARIOS)}")


def log_values(row, entry):
    """The values to write on a connector's log document for a synthetic run."""
    fields = {name: name for name in STANDARD_FIELDS} | (entry.get("fields") or {})
    values = {}
    for std in STANDARD_FIELDS:
        target = fields[std]
        target = target[0] if isinstance(target, (list, tuple)) else target
        values[target] = row[std]
    for key, wanted in (entry.get("log_filter") or {}).items():
        if not isinstance(wanted, (list, tuple, dict)):
            values[key] = wanted
    return values


# ── Frappe-facing ─────────────────────────────────────────────────────────────

_ROWS_KEY = "alaiy_health_sim_rows"
_SETTING_KEY = "alaiy_health_sim_setting"


def _allowed():
    import frappe

    if not frappe.conf.get("health_simulation_allowed"):
        frappe.throw("Simulation is off on this site. Set health_simulation_allowed in the site config, on a build site only.")


def _target(connector_id=None, function_key=None):
    """(registry row, entry) of the connector function to simulate; the first scheduled one by default."""
    import frappe

    from alaiy_os.health.contract import normalise_health
    from alaiy_os.health.service import _registry_rows

    for row in _registry_rows():
        if connector_id and row["connector_id"] != connector_id:
            continue
        for entry in normalise_health(row.get("health")):
            if function_key and entry["key"] != function_key:
                continue
            if entry["scheduled"] or function_key:
                return row, entry
    frappe.throw("No connector function with a health list matches. Pass connector_id and function_key.")


def _interval_minutes(row, entry):
    import frappe

    from alaiy_os.health.intervals import parse_interval
    from alaiy_os.health.service import _read_interval

    interval = parse_interval(_read_interval(row, entry), entry.get("interval_unit"))
    if interval.kind != "ok":
        frappe.throw("The function's interval is off or invalid. Set a valid interval in the connector settings first.")
    return interval.minutes


def _state_of(row, entry, now):
    from alaiy_os.health.service import snapshot

    for connector in snapshot(now)["connectors"]:
        if connector["connector_id"] == row["connector_id"]:
            return next(f for f in connector["functions"] if f["key"] == entry["key"])


def run(scenario, connector_id=None, function_key=None, alerts=0):
    """Insert the scenario's rows, run the checks and report the state. `alerts=1` also stores state
    and posts to Slack the way the 5-minute job does."""
    import frappe
    from frappe.utils import now_datetime

    from alaiy_os.health import service

    _allowed()
    row, entry = _target(connector_id, function_key)
    now = now_datetime()
    created = []
    meta = frappe.get_meta(entry["log_doctype"])
    for run_row in build_rows(scenario, _interval_minutes(row, entry), now):
        values = {k: v for k, v in log_values(run_row, entry).items() if meta.has_field(k)}
        doc = frappe.get_doc({"doctype": entry["log_doctype"], **values}).insert(ignore_permissions=True)
        created.append([entry["log_doctype"], doc.name])
        if not meta.has_field(((entry.get("fields") or {}).get("started_at")) or "started_at"):
            frappe.db.set_value(entry["log_doctype"], doc.name, "creation", run_row["started_at"], update_modified=False)
    previous = json.loads(frappe.db.get_default(_ROWS_KEY) or "[]")
    frappe.db.set_default(_ROWS_KEY, json.dumps(previous + created))
    frappe.db.commit()
    if alerts:
        service.run_checks()
    function = _state_of(row, entry, now)
    return {"scenario": scenario, "connector": row["connector_id"], "function": entry["key"],
            "expected": EXPECTED[scenario], "actual": function["state"], "reason": function.get("reason"),
            "last_error": function.get("last_error"), "rows_written": len(created)}


def break_interval(value, connector_id=None, function_key=None):
    """Set the function's interval setting to `value` (for example "30" or "Disabled") and report
    the state. `cleanup` puts the original back."""
    import frappe
    from frappe.utils import now_datetime

    from alaiy_os.health.service import _read_interval, _settings

    _allowed()
    row, entry = _target(connector_id, function_key)
    settings = _settings(row)
    original = _read_interval(row, entry)
    if not frappe.db.get_default(_SETTING_KEY):
        frappe.db.set_default(_SETTING_KEY, json.dumps(
            {"connector_id": row["connector_id"], "setting": entry["interval_setting"], "original": original}))
    settings.db_set(entry["interval_setting"], value, update_modified=False)
    frappe.db.commit()
    function = _state_of(row, entry, now_datetime())
    return {"connector": row["connector_id"], "function": entry["key"], "set": value, "state": function["state"],
            "reason": function.get("reason")}


def cleanup():
    """Delete the synthetic rows and restore any interval changed by `break_interval`."""
    import frappe

    from alaiy_os.health.service import _registry_rows, _settings

    _allowed()
    rows = json.loads(frappe.db.get_default(_ROWS_KEY) or "[]")
    for doctype, name in rows:
        if frappe.db.exists(doctype, name):
            frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
    changed = json.loads(frappe.db.get_default(_SETTING_KEY) or "null")
    if changed:
        row = next(r for r in _registry_rows() if r["connector_id"] == changed["connector_id"])
        _settings(row).db_set(changed["setting"], changed["original"], update_modified=False)
    frappe.db.set_default(_ROWS_KEY, "[]")
    frappe.db.set_default(_SETTING_KEY, "")
    frappe.db.commit()
    return {"rows_deleted": len(rows), "interval_restored": bool(changed)}
