"""Check a connector's health list against its own repository, with no bench.

Reads connector_meta.py and the doctype JSON files beside it and returns a list of problems, each a
sentence naming the entry. An empty list means the entries should load and read on a real site.
"""

import json
import runpy
from pathlib import Path

from alaiy_os.health.contract import STANDARD_FIELDS, normalise_health
from alaiy_os.health.intervals import parse_interval

STANDARD_COLUMNS = {"name", "creation", "modified", "owner", "modified_by", "docstatus", "idx"}
# Logs Frappe itself provides: a connector may point at them without shipping the doctype.
EXTERNAL = {
    "Error Log": {"method", "error", "seen"},
    "Scheduled Job Log": {"status", "scheduled_job_type", "details"},
    "Integration Request": {"status", "integration_request_service", "error", "request_description"},
}


def _doctypes(root):
    found = {}
    for path in Path(root).rglob("*.json"):
        if "doctype" not in path.parts or "node_modules" in path.parts:
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if isinstance(data, dict) and data.get("name") and isinstance(data.get("fields"), list):
            found[data["name"]] = {f["fieldname"]: f for f in data["fields"] if "fieldname" in f}
    return found


def _names(source):
    return source if isinstance(source, (list, tuple)) else [source]


def check_connector(meta_path):
    meta_path = Path(meta_path)
    meta = runpy.run_path(str(meta_path)).get("connector_meta", {})
    try:
        entries = normalise_health(meta.get("health"))
    except ValueError as error:
        return [str(error)]

    doctypes = _doctypes(meta_path.parent.parent)
    errors = []
    for entry in entries:
        who = f"'{entry['key']}'"
        log = doctypes.get(entry["log_doctype"])
        columns = None
        if log is not None:
            columns = set(log) | STANDARD_COLUMNS
        elif entry["log_doctype"] in EXTERNAL:
            columns = EXTERNAL[entry["log_doctype"]] | STANDARD_COLUMNS
        else:
            errors.append(f"{who}: log doctype '{entry['log_doctype']}' is not in this repository")

        if columns is not None:
            mapping = {name: name for name in STANDARD_FIELDS} | entry["fields"]
            if mapping["status"] not in columns:
                errors.append(f"{who}: the log has no '{mapping['status']}' field to read the status from")
            for std, source in entry["fields"].items():
                for name in _names(source):
                    if name not in columns:
                        errors.append(f"{who}: '{std}' maps to '{name}', which the log does not have")
            for name in entry["log_filter"]:
                if name not in columns:
                    errors.append(f"{who}: the log filter uses '{name}', which the log does not have")

        if entry["scheduled"]:
            errors.extend(_interval_errors(who, entry["interval_setting"], meta.get("settings_doctype"),
                                           doctypes, entry["interval_unit"]))
        if entry["enabled_setting"]:
            errors.extend(_switch_errors(who, entry["enabled_setting"], meta.get("settings_doctype"), doctypes))
    return errors


def _interval_errors(who, setting, settings_doctype, doctypes, bare_unit=None):
    settings = doctypes.get(settings_doctype)
    if settings is None:
        return [f"{who}: the settings doctype '{settings_doctype}' is not in this repository, so the interval cannot be read"]
    field = settings.get(setting)
    if field is None:
        return [f"{who}: the settings doctype has no '{setting}' field"]
    if field.get("fieldtype") != "Select":
        return [f"{who}: '{setting}' must be a Select of values like '30 min' (it is {field.get('fieldtype')})"]
    return [
        f"{who}: the interval option '{option}' is not one the health check can read"
        for option in (field.get("options") or "").splitlines()
        if option.strip() and parse_interval(option, bare_unit).kind == "invalid"
    ]


def _switch_errors(who, setting, settings_doctype, doctypes):
    settings = doctypes.get(settings_doctype)
    if settings is None:
        return [f"{who}: the settings doctype '{settings_doctype}' is not in this repository, so the switch cannot be read"]
    field = settings.get(setting)
    if field is None:
        return [f"{who}: the settings doctype has no '{setting}' field"]
    if field.get("fieldtype") != "Check":
        return [f"{who}: '{setting}' must be a Check field (it is {field.get('fieldtype')})"]
    return []
