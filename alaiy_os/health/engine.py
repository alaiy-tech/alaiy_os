"""The state rules. Plain functions over run records: no Frappe, no database.

A run record is a dict: status (running|queued|success|failed|skipped), started_at, finished_at,
processed, changed, failed, skipped, error. `compute_state` takes the records of one function,
newest first, and says whether it is healthy and why.
"""

import math
from datetime import timedelta

from alaiy_os.health.intervals import parse_interval
from alaiy_os.health.scrub import scrub

DISABLED = "disabled"
INVALID = "config_invalid"
STUCK = "stuck"
FAILING = "failing"
OVERDUE = "overdue"
WARNING = "warning"
NO_DATA = "no_data"
HEALTHY = "healthy"

# Worst first. Alerts fire on a move into one of ALERT_STATES.
SEVERITY = [STUCK, FAILING, OVERDUE, INVALID, WARNING, NO_DATA, DISABLED, HEALTHY]
ALERT_STATES = {OVERDUE, STUCK, FAILING, INVALID}
IN_PROGRESS = {"running", "queued"}

DEFAULTS = {
    "scheduled": True,
    "expects_rows": True,       # always has work: three 0-row runs in a row is a warning
    "overdue_factor": 3,
    "overdue_floor_min": 15,    # 3 x a 1 minute interval would alarm on any queue delay
    "max_runtime_min": 60,
    "fail_streak": 3,
    "fail_ratio": 0.05,
    "fail_ratio_min_rows": 20,  # one failed row out of two is not a failure rate worth alerting
    "zero_streak": 3,
}


def _minutes(delta):
    return max(0, int(delta.total_seconds() // 60))


ERROR_WORDS = ("failed", "error", "errored", "failure")
REQUEST_DEFAULTS = {"window_min": 60, "min_requests": 5, "error_warn_rate": 0.1, "error_fail_rate": 0.5}


def error_words(fn):
    """The status words that count as a failed call, lower-cased."""
    return {str(word).lower() for word in (fn.get("error_statuses") or ERROR_WORDS)}


def compute_request_state(fn, rows, now, last_success_at=None, last_error=None, connector_enabled=True):
    """The state of a function that is a log of calls. `rows` are the calls in the window, newest
    first: {status, at, duration_ms, error}. Too few calls to judge is a warning only when one failed;
    no calls at all is "no data", never healthy."""
    cfg = {**REQUEST_DEFAULTS, **{k: v for k, v in fn.items() if v is not None}}
    failed_words = error_words(fn)
    total = len(rows)
    errors = sum(1 for r in rows if str(r.get("status") or "").lower() in failed_words)
    streak = 0
    for r in rows:
        if str(r.get("status") or "").lower() not in failed_words:
            break
        streak += 1
    durations = sorted(r["duration_ms"] for r in rows if r.get("duration_ms") is not None)
    average = round(sum(durations) / len(durations)) if durations else None
    p95 = durations[max(math.ceil(0.95 * len(durations)) - 1, 0)] if durations else None
    window = cfg["window_min"]
    rate = errors / total if total else None
    out = {
        "key": fn.get("key"), "label": fn.get("label") or fn.get("key"), "direction": fn.get("direction"),
        "kind": "requests", "window_minutes": window, "requests": total, "error_rate": rate,
        "latency_avg_ms": average, "latency_p95_ms": p95,
        "last_status": rows[0].get("status") if rows else None,
        "last_run_at": rows[0].get("at") if rows else None,
        "last_success_at": last_success_at,
        "last_error": scrub(last_error),
        "last_counts": {"processed": total, "changed": total - errors, "failed": errors, "skipped": 0},
        "runs_24h": total, "failures_24h": errors, "consecutive_failures": streak,
        "lag_minutes": _minutes(now - last_success_at) if last_success_at else None,
        "interval_minutes": None, "running_minutes": None,
    }

    def done(state, reason=""):
        out["state"], out["reason"] = state, reason
        return out

    if not connector_enabled:
        return done(DISABLED, "The connector is not enabled")
    if not total:
        return done(NO_DATA, f"No requests in the last {window} minutes")
    percent = f"{rate * 100:.0f}%"
    if total < cfg["min_requests"]:
        if errors:
            return done(WARNING, f"{errors} of {total} requests failed in the last {window} minutes (too few requests to judge)")
        return done(HEALTHY)
    if rate >= cfg["error_fail_rate"]:
        return done(FAILING, f"{errors} of {total} requests failed in the last {window} minutes ({percent})")
    if rate >= cfg["error_warn_rate"]:
        return done(WARNING, f"{errors} of {total} requests failed in the last {window} minutes ({percent})")
    return done(HEALTHY)


def compute_state(fn, runs, now, interval_raw=None, connector_enabled=True, function_enabled=True):
    """Return the state of one function together with the figures the page shows."""
    cfg = {**DEFAULTS, **{k: v for k, v in fn.items() if v is not None}}
    interval = parse_interval(interval_raw, cfg.get("interval_unit")) if cfg["scheduled"] and fn.get("interval_setting") else None

    running = [r for r in runs if r.get("status") in IN_PROGRESS]
    # A run logged as "skipped" never started (another run was active): it is not evidence either way.
    finished = [r for r in runs if r.get("status") not in IN_PROGRESS and r.get("status") != "skipped"]
    last = finished[0] if finished else None
    # A "running" row older than a run that has since finished is an orphan (a killed worker), not a live run.
    if last and last.get("started_at"):
        running = [r for r in running if not r.get("started_at") or r["started_at"] >= last["started_at"]]
    last_success = next((r for r in finished if r.get("status") == "success"), None)
    last_success_at = (last_success.get("finished_at") or last_success.get("started_at")) if last_success else None

    streak = 0
    for r in finished:
        if r.get("status") != "failed":
            break
        streak += 1

    since = now - timedelta(hours=24)
    recent = [r for r in finished if r.get("started_at") and r["started_at"] >= since]
    running_for = _minutes(now - running[0]["started_at"]) if running and running[0].get("started_at") else None

    out = {
        "key": fn.get("key"),
        "label": fn.get("label") or fn.get("key"),
        "direction": fn.get("direction"),
        "last_status": last.get("status") if last else None,
        "last_run_at": last.get("started_at") if last else None,
        "last_success_at": last_success_at,
        "last_error": scrub(last.get("error")) if last else "",
        "last_counts": {k: (last.get(k) or 0) for k in ("processed", "changed", "failed", "skipped")} if last else None,
        "runs_24h": len(recent),
        "failures_24h": sum(1 for r in recent if r.get("status") == "failed"),
        "consecutive_failures": streak,
        "lag_minutes": _minutes(now - last_success_at) if last_success_at else None,
        "interval_minutes": interval.minutes if interval and interval.kind == "ok" else None,
        "running_minutes": running_for,
    }

    def done(state, reason=""):
        out["state"], out["reason"] = state, reason
        return out

    if not connector_enabled:
        return done(DISABLED, "The connector is not enabled")
    if not function_enabled:
        return done(DISABLED, "This function is switched off in the connector's settings")
    if interval is not None and interval.kind == "disabled":
        return done(DISABLED, "The sync interval is off")
    if interval is not None and interval.kind == "invalid":
        return done(INVALID, f"The interval '{interval_raw}' is not one the sync accepts")

    if running_for is not None and running_for > cfg["max_runtime_min"]:
        return done(STUCK, f"A run has been going for {running_for} minutes")

    if last is not None:
        if streak >= cfg["fail_streak"]:
            return done(FAILING, f"The last {streak} runs failed")
        processed, failed = last.get("processed") or 0, last.get("failed") or 0
        if processed > 0 and failed >= processed:
            return done(FAILING, "Every item in the last run failed")
        if processed >= cfg["fail_ratio_min_rows"] and failed / processed > cfg["fail_ratio"]:
            return done(FAILING, f"{failed} of {processed} items failed in the last run")

    if interval is not None and interval.kind == "ok" and last is not None:
        limit = max(cfg["overdue_factor"] * interval.minutes, cfg["overdue_floor_min"])
        # With no success on record, count from the oldest visible run: one early failure is not
        # overdue yet, a sync that never works becomes overdue.
        ref = last_success_at or finished[-1].get("started_at")
        lag = _minutes(now - ref) if ref else 0
        if lag > limit:
            what = "No successful run" if last_success_at else "Never succeeded"
            return done(OVERDUE, f"{what} for {lag} minutes (expected every {interval.minutes})")

    if last is None:
        return done(NO_DATA, "First run in progress" if running else "No runs recorded yet")

    if (last.get("skipped") or 0) > 0:
        return done(WARNING, "Rows were skipped in the last run")
    zero = finished[: cfg["zero_streak"]]
    if (cfg["expects_rows"] and len(zero) >= cfg["zero_streak"]
            and all(r.get("status") == "success" and not (r.get("processed") or 0) for r in zero)):
        return done(WARNING, f"The last {cfg['zero_streak']} runs succeeded but processed nothing")

    return done(HEALTHY)


def worst(states):
    """The worst state in a list, for a connector-level summary."""
    return min(states, key=SEVERITY.index) if states else NO_DATA
