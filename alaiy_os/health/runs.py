"""Reading a connector's own sync log into run records, and finishing a run honestly.

`finish_run` is for the connector: a run cannot end "success" when every item failed or every row
was skipped. `read_runs` is for core: one bounded query against the connector's log.
"""

from alaiy_os.health.contract import STANDARD_FIELDS
from alaiy_os.health.scrub import scrub

_IDENTITY = {name: name for name in STANDARD_FIELDS}
_ALIASES = {"completed": "success", "complete": "success", "done": "success",
            "error": "failed", "errored": "failed"}


def run_status(processed, failed, skipped, error=None):
    if processed > 0 and failed >= processed:
        return "failed"
    if processed == 0 and (error or skipped > 0):
        return "failed"
    return "success"


def _names(source):
    return source if isinstance(source, (list, tuple)) else [source]


def _count(row, source):
    return sum(int(row.get(name) or 0) for name in _names(source))


def normalise_run(row, fields=None, status_map=None):
    f = {**_IDENTITY, **(fields or {})}
    aliases = {**_ALIASES, **{str(k).lower(): v for k, v in (status_map or {}).items()}}
    status = str(row.get(f["status"]) or "").strip().lower()
    started, finished = row.get(f["started_at"]), row.get(f["finished_at"])
    if started and finished and finished < started:
        finished = None
    return {
        "status": aliases.get(status, status),
        "started_at": started,
        "finished_at": finished,
        "processed": _count(row, f["processed"]),
        "changed": _count(row, f["changed"]),
        "failed": _count(row, f["failed"]),
        "skipped": _count(row, f["skipped"]),
        "error": row.get(f["error"]) or "",
    }


def finish_run(log, processed, failed=0, skipped=0, error=None, fields=None, now=None):
    """Set the closing fields of a sync log document. The caller saves it."""
    f = {**_IDENTITY, **(fields or {})}
    if now is None:
        import frappe.utils
        now = frappe.utils.now_datetime()

    def put(std, value):
        if log.meta.has_field(f[std]):
            setattr(log, f[std], value)

    put("status", run_status(processed, failed, skipped, error))
    put("finished_at", now)
    put("processed", processed)
    put("failed", failed)
    put("skipped", skipped)
    if error:
        put("error", scrub(error, max_len=500))


def _filter_list(log_filter):
    """A log filter dict as the list form Frappe takes, so a time condition can sit beside it."""
    out = []
    for field, wanted in (log_filter or {}).items():
        if isinstance(wanted, (list, tuple)) and len(wanted) == 2:
            out.append([field, wanted[0], wanted[1]])
        else:
            out.append([field, "=", wanted])
    return out


def read_requests(entry, now, limit=1000):
    """(rows, last_success_at, last_error) for a request log: the calls in the entry's window, newest
    first, then the last call that did not fail whenever it was, then the last failure's message. Three
    bounded queries on the connector's own log."""
    from datetime import timedelta

    import frappe

    from alaiy_os.health.engine import error_words

    f = {**_IDENTITY, "duration": "duration", **(entry.get("fields") or {})}
    doctype = entry["log_doctype"]
    meta = frappe.get_meta(doctype)
    time_field = f["started_at"] if meta.has_field(f["started_at"]) else "creation"
    status_field, error_field, duration_field = f["status"], f["error"], f["duration"]
    base = _filter_list(entry.get("log_filter"))
    failed = sorted(error_words(entry))
    wanted = [time_field, status_field]
    for name in (duration_field, error_field):
        if meta.has_field(name) and name not in wanted:
            wanted.append(name)

    cutoff = now - timedelta(minutes=entry.get("window_min") or 60)
    rows = frappe.get_all(doctype, filters=base + [[time_field, ">=", cutoff]], fields=wanted,
                          order_by=f"{time_field} desc", limit=limit)
    out = [{
        "status": str(row.get(status_field) or "").strip().lower(), "at": row.get(time_field),
        "duration_ms": row.get(duration_field) if meta.has_field(duration_field) else None,
        "error": (row.get(error_field) if meta.has_field(error_field) else "") or "",
    } for row in rows]

    ok = frappe.get_all(doctype, filters=base + [[status_field, "not in", failed]], fields=[time_field],
                        order_by=f"{time_field} desc", limit=1, pluck=time_field)
    bad = frappe.get_all(doctype, filters=base + [[status_field, "in", failed]],
                         fields=[error_field if meta.has_field(error_field) else status_field],
                         order_by=f"{time_field} desc", limit=1)
    message = (bad[0].get(error_field if meta.has_field(error_field) else status_field) if bad else "") or ""
    return out, (ok[0] if ok else None), message


def read_runs(entry, limit=50):
    """The latest runs of one function, newest first. One bounded query on the connector's own log."""
    import frappe

    f = {**_IDENTITY, **(entry.get("fields") or {})}
    meta = frappe.get_meta(entry["log_doctype"])
    wanted = []
    for std in STANDARD_FIELDS:
        for name in _names(f[std]):
            if meta.has_field(name) and name not in wanted:
                wanted.append(name)
    time_column = f["started_at"] if meta.has_field(f["started_at"]) else "creation"
    if time_column not in wanted:
        wanted.append(time_column)
    rows = frappe.get_all(
        entry["log_doctype"],
        filters=entry.get("log_filter") or {},
        fields=wanted,
        order_by=f"{time_column} desc",
        limit=limit,
    )
    f = {**f, "started_at": time_column}
    return [normalise_run(row, f, entry.get("status_map")) for row in rows]
