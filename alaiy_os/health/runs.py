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
    if processed == 0 and error:
        return "failed"
    if processed == 0 and skipped > 0:
        return "skipped"
    return "success"


def _names(source):
    return source if isinstance(source, (list, tuple)) else [source]


def _count(row, source):
    return sum(int(row.get(name) or 0) for name in _names(source))


def normalise_run(row, fields=None, status_map=None):
    f = {**_IDENTITY, **(fields or {})}
    aliases = {**_ALIASES, **(status_map or {})}
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
    return [normalise_run(row, f, entry.get("status_map")) for row in rows]
