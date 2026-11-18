# Connector Health

One admin page, `/app/connector-health` (System Manager only), showing for every connector function
when it last synced, whether it did real work, and the last error. The same data is available as
JSON from `alaiy_os.api.health.get_health`.

"Test connection" proves the credentials. It says nothing about whether syncs run. Connector Health
compares the last successful run with what is expected, and treats "success" with no work done as a
problem.

## How it works

1. Each connector lists its functions in `connector_meta.py` under `"health"`. The install step already
   copies `connector_meta` into the OS Connector Registry; the registry's `health` field is checked on save.
2. A job every 5 minutes (`alaiy_os.health.service.run_checks`) reads each function's own sync log, applies
   the state rules, runs the platform checks, stores the result in `OS Connector Health State` and posts
   to Slack when a state changes. A daily job (`send_digest`) lists anything still not healthy.
3. The page and the API call the same collection code.

## The health list

One entry per function, in `connector_meta["health"]`:

| Key | Meaning |
|---|---|
| `key`, `label`, `log_doctype` | Required. Stable id, display name, the connector's own log doctype |
| `log_filter` | Filter selecting this function's rows, for example `{"sync_type": "stock"}` |
| `fields` | Map from the log's field names to the standard ones: `status`, `started_at`, `finished_at`, `processed`, `changed`, `failed`, `skipped`, `error`. A value may be a list of fields, which are summed |
| `status_map` | Extra status words, for example `{"partial": "failed"}`. `completed`, `done` mean success; `error` means failed |
| `interval_setting` | Field on the connector's settings doctype holding the expected interval. Must be a Select with options like `Disabled`, `5 min`, `1 hour`, `1 day` (`Hourly`, `Daily` and `Weekly` are also read) |
| `interval_unit` | `min`, `hour` or `day`: what a number with no unit means in that field, for connectors that store plain numbers |
| `enabled_setting` | A Check field on the settings doctype that switches this one function on or off; off shows Disabled instead of Overdue |
| `scheduled` | `false` for on-demand or webhook-driven functions: they are never overdue |
| `expects_rows` | `true` (default) when the function always has work, so three runs that process nothing is a warning |
| `direction` | `pull` (default) or `push` |
| `max_runtime_min`, `overdue_floor_min`, `overdue_factor` | Optional per-function overrides |

A run whose status is `skipped` means it never started (another run was active); it is ignored. A run still `running` that started before a newer finished run is treated as orphaned, not stuck. When the log has no start column the row's creation time is used.

Check a list without a bench:

```
python scripts/check_health_meta.py path/to/connector_meta.py
```

It reads the connector's doctype files and reports a missing log or settings doctype, a field that does
not exist, an interval option the engine cannot read, and so on.

A connector's sync code can use `alaiy_os.health.runs.finish_run(log, processed, failed, skipped, error)`
so a run cannot end `success` when every item failed or every row was skipped.

## States

Worst first: stuck, failing, overdue, config invalid, warning, no data, disabled, healthy.

- **Disabled:** the connector or its interval is off.
- **Config invalid:** the interval is not one the sync accepts (for example `30` with no unit), or the
  settings could not be read.
- **Stuck:** a run still in progress past the maximum runtime (default 60 minutes).
- **Failing:** the last 3 finished runs failed, every item of the last run failed, or more than 5% failed
  once at least 20 rows were processed.
- **Overdue:** no success for more than 3 times the interval, never under 15 minutes. With no success on
  record, counted from the oldest visible run.
- **Warning:** rows were skipped in the last run, or the last 3 runs succeeded with 0 rows for a function
  that expects rows.
- **No data:** no runs recorded. Never shown as healthy. A connector with no health list shows
  "No health contract".

Config invalid, overdue, stuck and failing alert. A settings record that was never saved counts as unreadable (config invalid), never as disabled.

## Platform checks

Scheduler enabled and a scheduled job ran in the last 10 minutes; background workers serve the default,
short and long queues; the cache accepts a write and returns it; the database answers; the site disk has at
least 15% free (override with `health_disk_min_free_pct` in site config); queue backlog. A check that fails
to run is red, with the exception class only.

## Alerts

Set `alert_slack_webhook` in site config to a Slack incoming webhook. One message per change into a bad
state, one on recovery, a daily digest. No webhook means no messages. A problem is announced once, when it starts; moving between bad states is the same problem. A function that flaps is not announced again within 60 minutes, and a problem that lasts longer is announced when the cooldown ends. More than 5 changes in one run (a first run, an outage) go out as one summary. Alerts are at most once: the state is stored before posting, so a post that fails is logged in the Error Log and not retried. The alert job runs on the scheduler, so a stopped scheduler cannot alert on itself: the Scheduler platform check shows it on the page. Error text is cut to its first line
and credentials are removed before it reaches the page or Slack.

## Acceptance run on the build server

Never on a client site. Replace `SITE` with the build site.

The page's Run button starts the sync in a background worker and returns at once.

1. Deploy the branch, then `bench --site SITE migrate` and `bench --site SITE clear-cache`, and restart the web
   and worker supervisor groups of that bench. Open `/app/connector-health`: every connector with a health
   list should show rows; connectors without one show "No health contract".
2. Smoke: `bench --site SITE execute alaiy_os.health.service.run_checks` prints the changes.
3. Stop the scheduler (`bench --site SITE scheduler disable`): after 3 times the shortest interval, never
   under 15 minutes, a function reads Overdue and, with a webhook set, an alert is posted. Re-enable with
   `scheduler enable`.
4. A run that processes 0 rows three times reads Warning; a run where every item failed reads Failing, even
   if it ended `success`.
5. Save an invalid interval value (for example `30`): Config invalid.
6. Make the remote API return 401 (wrong credentials): Failing, with the error shown.
7. Fill the disk past the threshold: the Disk space check goes red. Free it afterwards.
8. Kill a worker mid-run: the function reads Stuck after the maximum runtime, then Failing.
