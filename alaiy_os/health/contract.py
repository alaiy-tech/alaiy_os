"""The health list a connector declares in its registry row.

Each entry names one function the connector performs and where its own log and interval setting
live. A malformed list is refused when the row is saved, with a message naming the entry and key.
"""

import json

STANDARD_FIELDS = ("status", "started_at", "finished_at", "processed", "changed", "failed", "skipped", "error")

REQUIRED = ("key", "label", "log_doctype")
OPTIONAL = {
    "direction": "pull",
    "log_filter": {},
    "fields": {},
    "status_map": {},
    "interval_setting": None,
    "scheduled": True,
    "expects_rows": True,
    "max_runtime_min": None,
    "overdue_floor_min": None,
    "overdue_factor": None,
}


def _fail(index, message):
    raise ValueError(f"Health entry {index}: {message}")


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
        bad = set(entry["fields"]) - set(STANDARD_FIELDS)
        if bad:
            _fail(index, f"'fields' names '{sorted(bad)[0]}', which is not a standard field")
        if entry["scheduled"] and not entry["interval_setting"]:
            _fail(index, "a scheduled function needs 'interval_setting'")
        entries.append(entry)
    return entries
