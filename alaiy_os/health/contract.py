"""The health list a connector declares in its registry row.

Each entry names one function the connector performs and where its own log and interval setting
live. A malformed list is refused when the row is saved, with a message naming the entry and key.
"""

import json

STANDARD_FIELDS = ("status", "started_at", "finished_at", "processed", "changed", "failed", "skipped", "error")
REQUEST_FIELDS = ("status", "started_at", "error", "duration")  # what a request log can map

REQUIRED = ("key", "label", "log_doctype")
OPTIONAL = {
    "direction": "pull",
    "log_filter": {},
    "fields": {},
    "status_map": {},
    "interval_setting": None,
    "interval_unit": None,
    "enabled_setting": None,
    "scheduled": True,
    "expects_rows": True,
    "max_runtime_min": None,
    "overdue_floor_min": None,
    "overdue_factor": None,
    # A function that is a log of calls rather than runs (kind "requests"): the last `window_min`
    # minutes of calls are judged, not a schedule.
    "kind": "runs",
    "window_min": 60,
    "min_requests": 5,
    "error_warn_rate": 0.1,
    "error_fail_rate": 0.5,
    "error_statuses": None,
    "log_external": False,  # the log doctype is kept by another app, so it cannot be checked in this repo
}


def _fail(index, message):
    raise ValueError(f"Health entry {index}: {message}")


def _check_requests(index, entry):
    window, minimum = entry["window_min"], entry["min_requests"]
    if not isinstance(window, int) or isinstance(window, bool) or window < 5:
        _fail(index, "'window_min' must be a whole number of at least 5")
    if not isinstance(minimum, int) or isinstance(minimum, bool) or minimum < 1:
        _fail(index, "'min_requests' must be a whole number of at least 1")
    warn, fail = entry["error_warn_rate"], entry["error_fail_rate"]
    for rate in (warn, fail):
        if not isinstance(rate, (int, float)) or isinstance(rate, bool) or not 0 <= rate <= 1:
            _fail(index, "the error rates must be between 0 and 1")
    if warn > fail:
        _fail(index, "'error_warn_rate' cannot be above 'error_fail_rate'")
    statuses = entry["error_statuses"]
    if statuses is not None and not (isinstance(statuses, list) and all(isinstance(s, str) for s in statuses)):
        _fail(index, "'error_statuses' must be a list of status words")


def _entries(value):
    if value in (None, "", []):
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            raise ValueError("The health list is not valid JSON") from None
    if not isinstance(value, list):
        raise ValueError("The health list must be a list of entries")
    return value


def normalise_health(value):
    """Return the validated entries with defaults filled in, or raise ValueError."""
    entries, seen = [], set()
    for index, raw in enumerate(_entries(value)):
        if not isinstance(raw, dict):
            _fail(index, "each entry must be an object")
        for key in REQUIRED:
            if not raw.get(key):
                _fail(index, f"'{key}' is required")
        unknown = set(raw) - set(REQUIRED) - set(OPTIONAL)
        if unknown:
            _fail(index, f"unknown key '{sorted(unknown)[0]}'")

        entry = {**{k: (v.copy() if isinstance(v, dict) else v) for k, v in OPTIONAL.items()}, **raw}
        if entry["key"] in seen:
            _fail(index, f"duplicate key '{entry['key']}'")
        seen.add(entry["key"])

        if entry["direction"] not in ("pull", "push"):
            _fail(index, "'direction' must be 'pull' or 'push'")
        if entry["kind"] not in ("runs", "requests"):
            _fail(index, "'kind' must be 'runs' or 'requests'")
        requests = entry["kind"] == "requests"
        allowed = REQUEST_FIELDS if requests else STANDARD_FIELDS
        bad = set(entry["fields"]) - set(allowed)
        if bad:
            _fail(index, f"'fields' names '{sorted(bad)[0]}', which is not a field of a {entry['kind']} log")
        if requests:
            entry["scheduled"] = False
            _check_requests(index, entry)
        if entry["interval_unit"] not in (None, "min", "hour", "day"):
            _fail(index, "'interval_unit' must be 'min', 'hour' or 'day'")
        if entry["scheduled"] and not entry["interval_setting"]:
            _fail(index, "a scheduled function needs 'interval_setting'")
        entries.append(entry)
    return entries


def health_for_storage(value):
    """The normalised list as the JSON text kept on the registry row, or "" for none."""
    entries = normalise_health(value)
    return json.dumps(entries) if entries else ""
