"""Try Connector Health on a build site by writing synthetic runs into a connector's own log.

Never for a client site: it inserts rows and can change settings. It refuses to run unless the site
config has `health_simulation_allowed` set, which only a build site should have.

    bench --site SITE set-config health_simulation_allowed 1
    bench --site SITE execute alaiy_os.health.simulate.demo          # fill the page with every state
    bench --site SITE execute alaiy_os.health.simulate.run --kwargs "{'scenario': 'overdue'}"
    bench --site SITE execute alaiy_os.health.simulate.cleanup       # remove rows, restore settings

`build_rows`, `log_values`, `plan_demo`, `status_value` and the scenario table are plain Python and tested; the
rest touches Frappe and has not been run on a bench.
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

# The order a demo hands scenarios out: mostly healthy, with every problem showing up once per cycle.
DEMO_ORDER = ("healthy", "healthy", "overdue", "failing_all_items", "healthy", "zero_rows",
              "failing_runs", "healthy", "stuck", "skipped_rows")


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


def fits(scenario, info):
    """Whether a function can show a scenario. `info` has `scheduled`, `expects_rows` and `can_skip`
    (the log has a column that records skipped rows)."""
    if scenario == "overdue":
        return bool(info["scheduled"])
    if scenario == "zero_rows":
        return bool(info["expects_rows"])
    if scenario == "skipped_rows":
        return bool(info["can_skip"])
    return True


def plan_demo(infos):
    """One scenario per function, in order, each one the function can show."""
    plan = []
    for index, info in enumerate(infos):
        for step in range(len(DEMO_ORDER)):
            scenario = DEMO_ORDER[(index + step) % len(DEMO_ORDER)]
            if fits(scenario, info):
                break
        plan.append(scenario)
    return plan


def interfering(rows, oldest_start):
    """Names of real rows, given as (name, started_at), that are newer than the oldest synthetic run.
    A real run after the synthetic ones would decide the state instead of the scenario."""
    return [name for name, started in rows if started and started >= oldest_start]


_SUCCESS_WORDS = ("success", "completed", "complete", "done")
_FAILED_WORDS = ("failed", "error", "errored")


def status_value(status, options):
    """The option a log's status field holds for a standard status (`running`, `success`, `failed`).
    A log with no options takes the plain word; a status the log cannot hold is None, never guessed."""
    if not options:
        return status
    words = {"success": _SUCCESS_WORDS, "failed": _FAILED_WORDS}.get(status, (status,))
    by_lower = {option.strip().lower(): option.strip() for option in options if option.strip()}
    for word in words:
        if word in by_lower:
            return by_lower[word]
    return None


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
_CHANGES_KEY = "alaiy_health_sim_changes"


def _allowed():
    import frappe

    if not frappe.conf.get("health_simulation_allowed"):
        frappe.throw("Simulation is off on this site. Set health_simulation_allowed in the site config, on a build site only.")


def _store():
    import os

    import frappe

    return os.path.join(frappe.get_site_path("private"), "health_simulation.json")


def _load(key):
    import os

    path = _store()
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as handle:
        return json.load(handle).get(key, [])


def _save(key, value):
    import os

    path = _store()
    data = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    data[key] = value
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle)


def _targets(connector_id=None, function_key=None):
    """[(registry row, entry)] for every function with a health list, filtered if asked."""
    from alaiy_os.health.contract import normalise_health
    from alaiy_os.health.service import _registry_rows

    found = []
    for row in _registry_rows():
        if connector_id and row["connector_id"] != connector_id:
            continue
        for entry in normalise_health(row.get("health")):
            if not function_key or entry["key"] == function_key:
                found.append((row, entry))
    return found


def _remember(change):
    _save(_CHANGES_KEY, _load(_CHANGES_KEY) + [change])


def _interval_minutes(row, entry, make_valid=False):
    """The function's interval in minutes. With `make_valid`, an off or invalid interval is set to a
    working one for the duration of the simulation (and put back by `cleanup`)."""
    import frappe

    from alaiy_os.health.intervals import parse_interval
    from alaiy_os.health.service import _read_interval, _settings

    try:
        raw = _read_interval(row, entry)
    except LookupError:
        raw = None
    interval = parse_interval(raw, entry.get("interval_unit"))
    if interval.kind == "ok":
        return interval.minutes
    if not make_valid:
        frappe.throw("The function's interval is off or invalid. Set a valid interval in the connector settings first.")
    field = frappe.get_meta(frappe.get_doc("OS Connector Registry", row["connector_id"]).settings_doctype).get_field(entry["interval_setting"])
    options = [o for o in (field.options or "").splitlines() if o.strip()]
    usable = [o for o in options if parse_interval(o, entry.get("interval_unit")).kind == "ok"]
    chosen = next((o for o in usable if "30" in o), usable[0] if usable else None)
    if chosen is None:
        frappe.throw(f"No usable interval option on {entry['interval_setting']}")
    _remember({"kind": "setting", "connector_id": row["connector_id"], "setting": entry["interval_setting"], "original": raw})
    settings = _settings(row)
    if settings.is_new() or not settings.get("modified"):
        # Never saved: save once so the record exists and the interval can be read back.
        settings.set(entry["interval_setting"], chosen)
        settings.save(ignore_permissions=True)
    else:
        settings.db_set(entry["interval_setting"], chosen, update_modified=False)
    return parse_interval(chosen, entry.get("interval_unit")).minutes


def _switch_on(row, entry):
    """Turn on the connector (registry) and the function's own switch for the duration of a demo."""
    import frappe

    from alaiy_os.health.service import _read_switch, _settings

    if not row.get("is_enabled"):
        _remember({"kind": "enabled", "connector_id": row["connector_id"], "original": 0})
        frappe.db.set_value("OS Connector Registry", row["connector_id"], "is_enabled", 1, update_modified=False)
        row["is_enabled"] = 1
    if entry.get("enabled_setting") and not _read_switch(row, entry):
        _remember({"kind": "switch", "connector_id": row["connector_id"], "setting": entry["enabled_setting"], "original": 0})
        _settings(row).db_set(entry["enabled_setting"], 1, update_modified=False)


def _info(entry):
    """What a function can show in a demo."""
    import frappe

    fields = {name: name for name in STANDARD_FIELDS} | (entry.get("fields") or {})
    try:
        can_skip = frappe.get_meta(entry["log_doctype"]).has_field(fields["skipped"])
    except Exception:
        can_skip = False
    return {"scheduled": entry["scheduled"], "expects_rows": entry["expects_rows"], "can_skip": can_skip}


def _park(entry, oldest_start):
    """Move real runs of this function that are newer than the synthetic ones far into the past, so the
    scenario decides the state. `cleanup` puts them back. Returns how many were parked."""
    from datetime import timedelta

    import frappe

    meta = frappe.get_meta(entry["log_doctype"])
    time_field = (entry.get("fields") or {}).get("started_at") or "started_at"
    if not meta.has_field(time_field):
        time_field = "creation"
    ours = {name for _, name in _load(_ROWS_KEY)}
    existing = frappe.get_all(entry["log_doctype"], filters=entry.get("log_filter") or {},
                              fields=["name", time_field], order_by=f"{time_field} desc", limit=50)
    rows = [(r["name"], r[time_field]) for r in existing if r["name"] not in ours]
    names = interfering(rows, oldest_start)
    started = dict(rows)
    for name in names:
        _remember({"kind": "park", "doctype": entry["log_doctype"], "name": name, "field": time_field,
                   "original": started[name].isoformat(sep=" ")})
        frappe.db.set_value(entry["log_doctype"], name, time_field, started[name] - timedelta(days=3650), update_modified=False)
    return len(names)


def _insert_rows(entry, rows):
    import frappe

    parked = _park(entry, min(r["started_at"] for r in rows))

    meta = frappe.get_meta(entry["log_doctype"])
    time_field = (entry.get("fields") or {}).get("started_at") or "started_at"
    status_field = (entry.get("fields") or {}).get("status") or "status"
    options = [o for o in ((meta.get_field(status_field).options if meta.has_field(status_field) else "") or "").splitlines()]
    created = []
    for run_row in rows:
        status = status_value(run_row["status"], options)
        if status is None:
            raise ValueError(f"The log's status field has no option for '{run_row['status']}'")
        values = {k: v for k, v in log_values({**run_row, "status": status}, entry).items() if meta.has_field(k)}
        doc = frappe.get_doc({"doctype": entry["log_doctype"], **values}).insert(ignore_permissions=True)
        created.append([entry["log_doctype"], doc.name])
        if not meta.has_field(time_field):
            frappe.db.set_value(entry["log_doctype"], doc.name, "creation", run_row["started_at"], update_modified=False)
    _save(_ROWS_KEY, _load(_ROWS_KEY) + created)
    return len(created), parked


def _state_of(row, entry, collected):
    for connector in collected["connectors"]:
        if connector["connector_id"] == row["connector_id"]:
            return next(f for f in connector["functions"] if f["key"] == entry["key"])


def run(scenario, connector_id=None, function_key=None, alerts=0):
    """Insert one scenario's rows for one function (the first scheduled one by default) and report the
    state. `alerts=1` also stores state and posts to Slack the way the 5-minute job does."""
    import frappe
    from frappe.utils import now_datetime

    from alaiy_os.health import service

    _allowed()
    targets = [t for t in _targets(connector_id, function_key) if t[1]["scheduled"] or function_key]
    if not targets:
        frappe.throw("No connector function with a health list matches. Pass connector_id and function_key.")
    row, entry = targets[0]
    now = now_datetime()
    written, parked = _insert_rows(entry, build_rows(scenario, _interval_minutes(row, entry, make_valid=True), now))
    frappe.db.commit()
    if alerts:
        service.run_checks()
    function = _state_of(row, entry, service.snapshot(now))
    return {"scenario": scenario, "connector": row["connector_id"], "function": entry["key"],
            "expected": EXPECTED[scenario], "actual": function["state"], "reason": function.get("reason"),
            "last_error": function.get("last_error"), "rows_written": written, "real_rows_parked": parked}


def demo(alerts=0):
    """Fill the Connector Health page: every function of every connector with a health list gets a
    scenario, so the page shows healthy, warning, failing, overdue and stuck rows. Intervals and
    switches that are off are turned on for the demo; `cleanup` puts them back. A connector that cannot
    be simulated is reported, not fatal."""
    from frappe.utils import now_datetime

    from alaiy_os.health import service

    _allowed()
    targets = _targets()
    plan = plan_demo([_info(entry) for _, entry in targets])
    now = now_datetime()
    done, skipped = [], []
    for (row, entry), scenario in zip(targets, plan):
        try:
            minutes = _interval_minutes(row, entry, make_valid=True) if entry["scheduled"] else 30
            _switch_on(row, entry)
            _, parked = _insert_rows(entry, build_rows(scenario, minutes, now))
            done.append((row, entry, scenario, parked))
        except Exception as exc:
            skipped.append({"connector": row["connector_id"], "function": entry["key"], "why": f"{type(exc).__name__}: {exc}"[:160]})
    import frappe

    frappe.db.commit()
    if alerts:
        service.run_checks()
    collected = service.snapshot(now)
    report = []
    for r, e, s, parked in done:
        state = (_state_of(r, e, collected) or {}).get("state")
        report.append({"connector": r["connector_id"], "function": e["key"], "scenario": s,
                       "expected": EXPECTED[s], "state": state, "match": state == EXPECTED[s], "real_rows_parked": parked})
    return {"simulated": len(report), "skipped": skipped, "functions": report}


def break_interval(value, connector_id=None, function_key=None):
    """Set a scheduled function's interval setting to `value` ("30" reads as config invalid, "Disabled"
    as disabled) and report the state. `cleanup` puts the original back."""
    import frappe
    from frappe.utils import now_datetime

    from alaiy_os.health import service

    _allowed()
    targets = [t for t in _targets(connector_id, function_key) if t[1]["scheduled"]]
    if not targets:
        frappe.throw("No scheduled connector function with a health list matches.")
    row, entry = targets[0]
    try:
        original = service._read_interval(row, entry)
    except LookupError:
        original = None
    _remember({"kind": "setting", "connector_id": row["connector_id"], "setting": entry["interval_setting"], "original": original})
    service._settings(row).db_set(entry["interval_setting"], value, update_modified=False)
    frappe.db.commit()
    function = _state_of(row, entry, service.snapshot(now_datetime()))
    return {"connector": row["connector_id"], "function": entry["key"], "set": value, "state": function["state"],
            "reason": function.get("reason")}


def cleanup():
    """Delete the synthetic rows and restore every setting the simulator changed."""
    import frappe

    from alaiy_os.health.service import _registry_rows, _settings

    _allowed()
    rows = _load(_ROWS_KEY)
    for doctype, name in rows:
        if frappe.db.exists(doctype, name):
            frappe.delete_doc(doctype, name, force=True, ignore_permissions=True)
    registry = {r["connector_id"]: r for r in _registry_rows()}
    restored = 0
    for change in reversed(_load(_CHANGES_KEY)):
        if change["kind"] == "park":
            if frappe.db.exists(change["doctype"], change["name"]):
                frappe.db.set_value(change["doctype"], change["name"], change["field"], change["original"], update_modified=False)
                restored += 1
            continue
        row = registry.get(change["connector_id"])
        if row is None:
            continue
        if change["kind"] == "enabled":
            frappe.db.set_value("OS Connector Registry", change["connector_id"], "is_enabled", change["original"], update_modified=False)
        else:
            _settings(row).db_set(change["setting"], change["original"], update_modified=False)
        restored += 1
    _save(_ROWS_KEY, [])
    _save(_CHANGES_KEY, [])
    frappe.db.commit()
    return {"rows_deleted": len(rows), "settings_restored": restored}
