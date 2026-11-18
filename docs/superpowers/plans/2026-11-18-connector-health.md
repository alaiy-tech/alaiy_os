# Connector Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One admin page and API, built in core, that shows for every connector function when it last synced, whether it did real work, and alerts when it stops.

**Architecture:** A `health` list in each connector's registry row names the connector's own log and settings. A pure state engine (no Frappe) turns recent run records into a state; Frappe-facing modules read logs, probe the platform and store states; a 5-minute job posts alerts; a Page and JSON API show the result.

**Tech Stack:** Frappe 16, Python 3.14 (pure parts tested with pytest, no bench), Frappe Page (JS) for the screen, Slack incoming webhook for alerts.

**Spec:** `docs/superpowers/specs/2026-11-18-connector-health-design.md`

## Global Constraints

- Frappe 16: aggregate query fields are dicts (`{"COUNT": "*", "as": "n"}`), never SQL function strings.
- No client, brand, site or server names in core code, docs or tests.
- Commits and PR text: professional English, no assistant mentions, no PR/issue numbers or dates.
- Pure modules (`intervals`, `engine`, `contract`, `scrub`, `alerts` message builders, `platform` decision functions, `runs.normalise_run`/`run_status`) import nothing from Frappe at module level.
- Every health query is bounded: `limit`, ordered by an indexed time column.
- Defaults: overdue 3x interval, floor 15 min; max runtime 60 min; failing = 3 failed runs, or every item failed, or >5% failed with >=20 rows; zero-row warning after 3 runs; scheduler ran within 10 min; disk free >= 15%.
- Never merge a PR; never push to `main`; branch `core/18-11` in core, `connectors/18-11` in connector repos.
- Frappe-facing code cannot run on this laptop (no bench): verify by reading `reference/frappe` source and fakes; the build-server runbook lists what remains.

## Review Focus

1. A connector whose settings record is missing or unreadable shows Config invalid, never Disabled or Healthy.
2. A connector with no `health` list shows "No health contract", never Healthy.
3. One connector's broken health entry or raising adapter must not stop the page or other connectors.
4. A very large or unindexed sync log must not slow the page: queries bounded and ordered on the time column.
5. Error text containing a key, token or URL is scrubbed before the page or Slack sees it.
6. Odd run rows: `finished_at` before `started_at`, future `started_at`, null counts, unknown status strings.
7. Alert storms: a flapping function alerts once per state change, not every 5 minutes; recovery alerts once.

---

### Task 1: Intervals and state engine (done)

**Files:** `alaiy_os/health/intervals.py`, `alaiy_os/health/engine.py`, `alaiy_os/tests/test_health_engine.py`

**Interfaces:**
- Produces: `parse_interval(value) -> Interval(kind, minutes)`; `compute_state(fn, runs, now, interval_raw, connector_enabled) -> dict`; state constants; `worst(states) -> str`; `ALERT_STATES`.

- [x] Tests and implementation written, 20 passing.
- [ ] Commit.

### Task 2: Contract validation and registry field

**Files:** Create `alaiy_os/health/contract.py`, `alaiy_os/tests/test_health_contract.py`; modify `alaiy_os/alaiy_os/doctype/os_connector_registry/os_connector_registry.json` (add `health` Code/JSON field after `handlers_health_detail`), `os_connector_registry.py`.

**Interfaces:**
- Produces: `normalise_health(value) -> list[dict]` (accepts a list or JSON string; raises `ValueError` naming the entry and key; fills defaults for `direction`, `scheduled`, `expects_rows`, `log_filter`, `fields`); `STANDARD_FIELDS`.
- Registry `validate()` stores the normalised list as a JSON string; `get_health_entries(row) -> list[dict]` returns `[]` for none.

- [ ] Tests: missing `key`/`label`/`log_doctype` raises with the entry index; unknown key raises; duplicate `key` raises; list and JSON string give the same result; empty/None gives `[]`.
- [ ] Implement `normalise_health`; add the field and the registry `validate` call.
- [ ] Run `python -m pytest alaiy_os/tests/test_health_contract.py -q`; expect all pass. Commit.

### Task 3: Run reading and `finish_run`

**Files:** Create `alaiy_os/health/runs.py`, `alaiy_os/health/scrub.py`, `alaiy_os/tests/test_health_runs.py`, `alaiy_os/tests/test_health_scrub.py`.

**Interfaces:**
- `run_status(processed, failed, skipped, error=None) -> str`: failed if processed>0 and failed>=processed, or error with nothing processed; `skipped` if processed==0 and skipped>0; else `success`.
- `finish_run(log, processed, failed=0, skipped=0, error=None, fields=None)`: sets status, `finished_at`, counts and error on a log document using the field map; skipped only if the log has that field; does not save.
- `normalise_run(row, fields, status_map=None) -> dict` (pure): lower-cases status; maps `completed`->success, `error`->failed; sums list-valued `changed`; null counts become 0; `finished_at` before `started_at` is dropped.
- `read_runs(entry, limit=50) -> list[dict]` (Frappe): `frappe.get_all(entry["log_doctype"], filters=entry["log_filter"], fields=<only fields that exist>, order_by=<time column> desc, limit=limit)`.
- `scrub(text, max_len=300) -> str`: first line only; replaces `Bearer ...`, `token=...`, `key=...`, long hex/base64-like strings and URL query strings with `[hidden]`.

- [ ] Tests: each status rule; every item failed marked success becomes `failed`; all skipped becomes `skipped`; `normalise_run` with list-valued changed, null counts, unknown status, inverted times; `scrub` removes a bearer token, an API key in a query string and a long secret while keeping the readable first line.
- [ ] Implement; run tests; commit.

### Task 4: Platform checks

**Files:** Create `alaiy_os/health/platform.py`, `alaiy_os/tests/test_health_platform.py`.

**Interfaces:**
- Pure: `scheduler_state(inactive_reason, last_execution, now) -> dict`; `workers_state(worker_queue_names, required=("default","short","long")) -> dict` (matches `<bench>:<queue>` by suffix); `disk_state(total, free, min_free_pct=15) -> dict`; `backlog_state(counts, warn=200, red=1000) -> dict`.
- Each returns `{"key", "label", "state": "ok"|"warn"|"red"|"unknown", "detail"}`.
- Frappe: `run_platform_checks(now) -> list[dict]` using `frappe.utils.scheduler.is_scheduler_inactive(verbose=False)`, `max(last_execution)` of non-stopped `Scheduled Job Type`, `frappe.utils.background_jobs.get_workers()`, `frappe.cache.set_value/get_value`, `frappe.db.sql("select 1")`, `shutil.disk_usage(frappe.get_site_path())`, `get_queue(q).count`. Any probe that raises returns `red` with the exception class only.

- [ ] Tests for each pure function incl. missing queue, 14.9% vs 15% disk, scheduler paused vs silent 11 minutes.
- [ ] Implement; run tests; commit.

### Task 5: State store and service

**Files:** Create doctype `alaiy_os/alaiy_os/doctype/os_connector_health_state/` (`.json`, `.py`, `__init__.py`), `alaiy_os/health/service.py`, `alaiy_os/health/changes.py`, `alaiy_os/tests/test_health_changes.py`.

**Interfaces:**
- Doctype fields: `state_key` (Data, unique, autoname `field:state_key`), `connector_id`, `function_key`, `state`, `since`, `last_checked`, `reason`, `last_alerted_state`, `last_alerted_at`.
- `changes.diff(previous: dict[str, dict], current: dict[str, dict], now) -> list[dict]` (pure): returns `{key, old, new, kind}` with `kind` in `alert`, `recovery`, `none`; alert only on moving into `ALERT_STATES` (or platform red) from a different state; recovery only from an alerted state back to healthy/warning; no repeat while unchanged.
- `service.collect(now) -> dict` returns `{"checked_at", "platform", "connectors": [{"connector_id","connector_name","state","has_contract","functions":[...]}]}`; per connector wrapped in try/except so one failure yields a single INVALID function with a generic reason; reads the interval from the connector's settings document via the registry's settings helper; unreadable settings yields interval `"?"` so the state is Config invalid.
- `service.record(collected, now) -> list[dict]` upserts state rows and returns the `changes.diff` result.

- [ ] Tests for `diff`: first sighting healthy -> none; healthy->failing alert; failing->failing none; failing->healthy recovery; flapping failing/overdue alerts once per state change not per run; platform red.
- [ ] Implement doctype and service; verify field names against `reference/frappe` docs for `get_all` and `autoname`; commit.

### Task 6: API and scheduled job

**Files:** Create `alaiy_os/api/health.py`; modify `alaiy_os/hooks.py` (`scheduler_events`); create `alaiy_os/tests/test_health_api.py`.

**Interfaces:**
- `@frappe.whitelist() get_health() -> dict`: `frappe.only_for("System Manager")`; returns `service.collect(now_datetime())` with datetimes serialised.
- `@frappe.whitelist() run_now(connector_id, function_key)`, `test_connection(connector_id)`: System Manager only; reuse the registry's sync and test methods; never accept a dotted path from the client.
- Hooks: `"cron": {"*/5 * * * *": ["alaiy_os.health.service.run_checks"], "0 8 * * *": ["alaiy_os.health.service.send_digest"]}`.

- [ ] Test the permission guard and that `run_now` rejects an unknown function key (fake frappe module).
- [ ] Implement; commit.

### Task 7: Alerts

**Files:** Create `alaiy_os/health/alerts.py`, `alaiy_os/tests/test_health_alerts.py`.

**Interfaces:**
- Pure: `alert_message(change, site, connector_name, label, reason, since) -> dict` (Slack payload with instance, connector, function, since, scrubbed reason); `recovery_message(...)`; `digest_message(site, items) -> dict | None` (None when nothing unhealthy).
- `post(payload)`: reads `alert_slack_webhook` from site config; no webhook = no-op; failures are logged to Error Log, never raised; webhook value never logged.

- [ ] Tests: payload contains no unscrubbed secret; digest None when healthy; one message per change.
- [ ] Implement; wire `run_checks` to post alerts for changes; commit.

### Task 8: Admin page

**Files:** Create `alaiy_os/alaiy_os/page/connector_health/` (`.json` with roles System Manager, `.js`, `.py`); modify `setup/install.py` `sync_custom_pages` list.

- [ ] Platform checks on top; a card per connector; a row per function with state dot and word, last synced (relative and exact), interval, last counts, scrubbed error, 24 h success/failed, Run now, Test connection, link to the log list; refresh every 60 seconds; "No health contract" row for connectors without one.
- [ ] Colours from the theme tokens already used in core desk styling only; no gradients, no shadows on cards.
- [ ] Verify page loads by reading JS against Frappe page API in `reference/frappe`; commit.

### Task 9: First connector adapter and `finish_run` adoption

**Files (first connector repo):** `connector_meta.py` (health list for each of its sync functions). Its sync code already ends a run failed when every item failed or rows were skipped, so no schema or sync change was needed.

- [ ] Health entries with `interval_setting` names `cs_*_sync_interval`, `log_filter` on `sync_type`.
- [ ] Stock sync records skipped rows instead of ending `success` with nothing written.
- [ ] Tests for the meta (entries valid through `normalise_health`).

### Task 10: Remaining adapters

**Files:** `connector_meta.py` in each connector repo that has a sync or request log.

- [ ] Survey every connector in `connectors/` (log doctypes, settings interval fields, field names); write entries with a `fields` map where names differ; on-demand functions `scheduled: false`; log-less connectors get a minimal entry from the registry test result.
- [ ] One test per connector that its entries validate.

### Task 11: Documentation and memory

- [ ] `docs/connector-health.md`: contract, states, adding a connector, build-server acceptance runbook.
- [ ] Add a Connector Health section to `knowledge_map.txt`; log to the daily summary.

### Task 12: Verification and review

- [ ] Run the full pure test suite; read each Frappe-facing module against `reference/frappe`.
- [ ] Fresh reviewer over the whole branch (correctness, secrets, Frappe 16 query rules, no client names).
- [ ] Open PRs (never merge): core and each connector, with title prefix, label and assignee per repo conventions.
