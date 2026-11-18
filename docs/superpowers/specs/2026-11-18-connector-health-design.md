# Connector Health: design

Status: approved.

## Intent

Today nothing shows whether a connector is actually working. "Test connection" proves the
credentials and nothing else. Syncs have stopped for months, ended "success" while writing nothing
or failing every item, hung for hours, and pushed with a rejected login hundreds of times, each
without anyone being told. The common cause: nothing compares "last successful run" with "what we
expect", and "success" does not mean "did useful work".

Build it once in core so every instance gets one admin page, **Connector Health**, listing every
function each installed connector performs with when it last synced, the result and the error.

## Goals

- One contract every connector declares; core reads the connector's own sync log, so a connector
  needs no schema change to appear (one exception below).
- A state for every function: healthy, warning, failing, overdue, stuck, config invalid, no data,
  disabled.
- Platform checks once per site: scheduler, workers, cache, database, disk, backlog.
- An admin page (System Manager only) and a JSON API.
- Alerts to a Slack webhook on a state change, with a recovery message and a daily digest.
- A shared `finish_run` helper so a run cannot end "success" when everything failed or was skipped.

## Non-goals

- A cross-instance dashboard (the JSON API only makes it possible later).
- Repairing data or restarting anything. Health reports; it never fixes.
- Replacing a connector's own sync log or settings screen.
- Connectors with no run log of their own in the first release (they show "No health contract" until they gain one).

## Anti-goals

- A sync showing healthy when there is no data about it.
- A page or alert that shows a secret. Error text is cut to its first line and scrubbed.
- A health query that is slow on a large log table.

## Constraints

- Frappe 16. Core has no scheduled job today; this adds one.
- Frappe keeps no scheduler "last tick"; liveness comes from `Scheduled Job Type.last_execution`.
- Worker liveness comes from the queue workers (`get_workers`), queue backlog from `get_queue(...)`.
- The database server's disk cannot be read reliably from the app; the check covers the site disk
  and reports the database disk as unknown unless the database is local.
- Acceptance tests that stop the scheduler, fill a disk or kill a worker run only on the build
  server, never on a client site.
- Nothing client-specific in core code, docs or tests.

## Approaches considered

1. **A `health` JSON field on the registry (chosen).** Connectors list their functions in
   `connector_meta.py`; install already upserts the meta into the registry. One new field, no new
   doctype per connector, and a validator rejects a malformed list at registration time.
2. **A child table on the registry.** Queryable, but a connector would have to pass nested JSON as
   strings, and a Table field needs its own doctype. More moving parts for no gain here.
3. **A method per connector that returns its own health.** Flexible, but every connector repeats the
   same rules and the rules drift. Kept only as an optional escape hatch (`health_method`).

## Design

### Contract

Each entry of `connector_meta["health"]`:

| Key | Meaning |
|---|---|
| `key`, `label` | Stable id and display name (required) |
| `direction` | `pull` or `push` |
| `log_doctype`, `log_filter` | The connector's own log and the filter selecting this function |
| `fields` | Optional map from the log's field names to the standard ones (`status`, `started_at`, `finished_at`, `processed`, `changed`, `failed`, `skipped`, `error`) |
| `interval_setting` | Settings field holding the expected interval, for example "30 min" |
| `scheduled` | False for on-demand functions: they are never overdue |
| `expects_rows` | True when the function always has work, so repeated 0-row runs warn |
| `max_runtime_min`, `overdue_floor_min` | Optional per-function overrides |
| `health_method` | Optional dotted path returning extra results for custom checks |

### State rules (defaults, per-function overrides)

Order of precedence: disabled, config invalid, stuck, failing, overdue, warning, no data, healthy.

- **Disabled:** connector off or interval "Disabled".
- **Config invalid:** the interval is not one the sync accepts (for example "30" with no unit).
- **Stuck:** a run still in progress past the maximum runtime (default 60 minutes).
- **Failing:** the last 3 finished runs failed, or every item of the last run failed, or more than
  5% failed once at least 20 rows were processed.
- **Overdue:** no success for more than 3 times the interval, never under 15 minutes. With no
  success on record, counted from the oldest visible run.
- **Warning:** rows were skipped, or the last 3 runs succeeded with 0 rows for a function that
  expects rows.
- **No data:** no runs recorded. Never healthy.

### Platform checks

Scheduler enabled and a scheduled job ran in the last 10 minutes; workers alive on default, short
and long queues; cache writable; database reachable; site disk free above 15%; queue backlog.

### Page, API, alerts

- Frappe Page `/app/connector-health`: platform checks on top, one card per connector with a row per
  function (state colour, last synced relative and exact, interval, last counts, last error, 24 h
  success and failed, Run now and Test connection reusing the registered methods, link to the log).
  Refreshes every 60 seconds. The page follows the desk theme already in core.
- `alaiy_os.api.health.get_health` returns the same data as JSON (System Manager only).
- A 5-minute job computes every state, stores it in `OS Connector Health State`, and posts to the
  Slack webhook in site config on a move into overdue, stuck, failing or a red platform check; one
  alert per change, a recovery message, and a daily digest of anything not healthy.

### Order of work

1. Contract, state engine, platform checks.
2. The admin page.
3. The first connector adapter (the one with known failure modes).
4. Alerts.
5. The other adapters.
6. Rollout, with acceptance tests on the build server.

## Left to the builder

Exact wording of states and reasons, page layout details, scrubbing rules for error text, and the
indexes the health queries need on each connector's log doctype.
