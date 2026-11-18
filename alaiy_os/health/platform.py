"""Platform checks, once per site: scheduler, workers, cache, database, disk, queue backlog.

Each probe touches Frappe or Redis and is thin; the decision it makes is a plain function above it,
tested without a bench. Every check returns {key, label, state, detail} with state ok, warn, red or
unknown. A probe that raises is red with the exception class only, never the message.
"""

from datetime import timedelta

REQUIRED_QUEUES = ("default", "short", "long")
SCHEDULER_SILENCE_MIN = 10


def _check(key, label, state, detail=""):
    return {"key": key, "label": label, "state": state, "detail": detail}


def scheduler_state(inactive_reason, last_execution, now, dormant=False):
    label = "Scheduler"
    if inactive_reason:
        return _check("scheduler", label, "red", f"The scheduler is off: {inactive_reason}")
    if last_execution is None:
        return _check("scheduler", label, "red", "No scheduled job has ever run")
    silent = int((now - last_execution).total_seconds() // 60)
    if silent > SCHEDULER_SILENCE_MIN:
        state = "warn" if dormant else "red"
        return _check("scheduler", label, state, f"No scheduled job has run for {silent} minutes")
    return _check("scheduler", label, "ok", f"A scheduled job ran {silent} minutes ago")


def workers_state(worker_queue_names, required=REQUIRED_QUEUES):
    label = "Background workers"
    if not worker_queue_names:
        return _check("workers", label, "red", "No background workers are running")
    served = {name.rsplit(":", 1)[-1] for names in worker_queue_names for name in names}
    missing = [queue for queue in required if queue not in served]
    if missing:
        return _check("workers", label, "red", f"No worker serves the {', '.join(missing)} queue")
    return _check("workers", label, "ok", f"{len(worker_queue_names)} workers")


def disk_state(total, free, min_free_pct=15):
    label = "Disk space"
    if not total:
        return _check("disk", label, "unknown", "The disk could not be read")
    pct = free * 100 / total
    detail = f"{pct:.0f}% free"
    if pct < min_free_pct:
        return _check("disk", label, "red", detail)
    if pct < min_free_pct + 10:
        return _check("disk", label, "warn", detail)
    return _check("disk", label, "ok", detail)


def backlog_state(counts, warn=200, red=1000):
    label = "Queue backlog"
    queue, size = max(counts.items(), key=lambda item: item[1], default=(None, 0))
    detail = f"{size} waiting on {queue}" if queue else "No queues"
    if size >= red:
        return _check("backlog", label, "red", detail)
    if size >= warn:
        return _check("backlog", label, "warn", detail)
    return _check("backlog", label, "ok", detail)


def _guard(key, label, probe):
    try:
        return probe()
    except Exception as exc:
        return _check(key, label, "red", f"The check failed: {type(exc).__name__}")


def run_platform_checks(now):
    """Run every probe and return the list of checks."""
    import shutil

    import frappe
    from frappe.utils.background_jobs import get_queue, get_workers
    from frappe.utils.scheduler import is_dormant, is_scheduler_inactive

    def scheduler():
        inactive = "paused, disabled or in maintenance mode" if is_scheduler_inactive(verbose=False) else None
        last = frappe.get_all(
            "Scheduled Job Type",
            filters={"stopped": 0, "last_execution": ["is", "set"]},
            fields=["last_execution"], order_by="last_execution desc", limit=1, pluck="last_execution",
        )
        return scheduler_state(inactive, last[0] if last else None, now, dormant=bool(is_dormant()))

    def workers():
        return workers_state([worker.queue_names() for worker in get_workers()])

    def cache():
        frappe.cache.set_value("alaiy_health_probe", "1", expires_in_sec=60)
        ok = frappe.cache.get_value("alaiy_health_probe", use_local_cache=False) == "1"
        return _check("cache", "Cache", "ok" if ok else "red", "" if ok else "A value written was not read back")

    def database():
        frappe.db.sql("select 1")
        return _check("database", "Database", "ok")

    def disk():
        usage = shutil.disk_usage(frappe.get_site_path())
        min_free = frappe.conf.get("health_disk_min_free_pct") or 15
        return disk_state(usage.total, usage.free, min_free)

    def backlog():
        return backlog_state({queue: get_queue(queue).count for queue in REQUIRED_QUEUES})

    return [
        _guard("scheduler", "Scheduler", scheduler),
        _guard("workers", "Background workers", workers),
        _guard("cache", "Cache", cache),
        _guard("database", "Database", database),
        _guard("disk", "Disk space", disk),
        _guard("backlog", "Queue backlog", backlog),
    ]
