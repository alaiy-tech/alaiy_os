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

Open **Connector Health Settings** (the page has an Alert settings button): paste a Slack incoming-webhook URL (https,
kept encrypted), switch alerts and the daily digest on or off, set the cooldown, save, and press **Send test message**.
A webhook in `alert_slack_webhook` in the site config still works and is used when the page has none. One message per change into a bad
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

## API for dashboards

Every instance serves the same endpoints, so a custom dashboard can read any deployment, or poll several and show
them side by side. Times are ISO 8601 with the site's offset, every response carries `schema` (currently 1), `instance`
(the site name), `generated_at` and `overall` (`ok`, `warning` or `critical`).

| Endpoint | Returns |
|---|---|
| `alaiy_os.api.health.get_summary` | Compact: overall status, `counts` per state, `total`, `attention`, the `platform` checks, the `problems` (functions needing attention, worst first, with reason, last error, last success and lag), and a one-line entry per connector. Small enough to poll every minute. |
| `alaiy_os.api.health.get_connector` (`connector_id`) | One connector with all its functions, in full. |
| `alaiy_os.api.health.get_report` | Everything the page shows: platform checks and every connector with every function. |

Add `live=1` to recompute instead of reading the snapshot the 5-minute job keeps warm (a snapshot older than 5 minutes
is recomputed anyway). Read access is for System Manager and OS Manager, so a dashboard can use a read-only user.

Authenticate with an API key: open the user, "API Access", Generate Keys, then send `Authorization: token KEY:SECRET`.
Frappe wraps every response in `{"message": ...}`.

```
curl -H "Authorization: token KEY:SECRET"   "https://SITE/api/method/alaiy_os.api.health.get_summary"

curl -H "Authorization: token KEY:SECRET"   "https://SITE/api/method/alaiy_os.api.health.get_connector?connector_id=cloudstore"
```

Several deployments, one dashboard (the keys belong in your dashboard's secret store, never in a page):

```python
import requests

INSTANCES = {"site-one": ("KEY", "SECRET"), "site-two": ("KEY", "SECRET")}
for site, (key, secret) in INSTANCES.items():
    summary = requests.get(f"https://{site}/api/method/alaiy_os.api.health.get_summary",
                           headers={"Authorization": f"token {key}:{secret}"}, timeout=15).json()["message"]
    print(site, summary["overall"], summary["attention"], "need attention of", summary["total"])
```

An abridged summary:

```json
{
  "schema": 1, "instance": "site-one", "generated_at": "2026-11-18T12:00:00+05:30", "overall": "critical",
  "total": 28, "attention": 11,
  "counts": {"healthy": 17, "warning": 2, "failing": 5, "overdue": 3, "stuck": 1, "config_invalid": 0, "no_data": 0, "disabled": 0},
  "platform": [{"key": "disk", "label": "Disk space", "state": "ok", "detail": "39% free"}],
  "problems": [{"connector_id": "fulfillmen", "connector_name": "Fulfillmen", "function_key": "stock", "function": "Stock",
                "state": "failing", "reason": "The last 3 runs failed", "last_error": "401 Unauthorized",
                "last_success_at": "2026-11-18T08:00:00+05:30", "lag_minutes": 240, "consecutive_failures": 3}],
  "connectors": [{"connector_id": "fulfillmen", "connector_name": "Fulfillmen", "state": "failing", "has_contract": true, "functions": 5}]
}
```

States in `counts` and `problems`: healthy, warning, failing, overdue, stuck, config_invalid, no_data, disabled. A connector
with no health list has state `no_contract` and zero functions. New keys may be added; existing ones keep their meaning
within a schema version.

## Trying it on the build server

The simulator writes synthetic runs into each connector's own log, so the page and the alerts can be exercised
without breaking anything real. It refuses to run unless the site opts in, so never enable it on a client site.

Prepare the bench (replace `BENCH` and `SITE`; the site name is the domain):

```
cd BENCH
bench --site SITE list-apps                    # what is installed on the site
ls apps                                        # what is on the bench

# core on its branch
git -C apps/alaiy_os fetch origin && git -C apps/alaiy_os checkout core/18-11 && git -C apps/alaiy_os pull origin core/18-11

# connectors: switch an existing app to its branch, or fetch the missing ones
for name in bigcommerce cloudstore competitor_sites explus fedex flipkart google_sheets keepa outersignal shopify triple_whale unicommerce walmart woocommerce fulfillmen; do
  app=alaiy_os_connector_$name
  if [ -d apps/$app ]; then
    git -C apps/$app fetch origin && git -C apps/$app checkout connectors/18-11 && git -C apps/$app pull origin connectors/18-11 || echo "SWITCH FAILED $app"
  else
    case $name in fulfillmen) org=NayaGlobal-organisation;; *) org=alaiy-tech;; esac
    bench get-app https://github.com/$org/$app --branch connectors/18-11 || echo "GET FAILED $app"
  fi
  bench --site SITE list-apps | awk '{print $1}' | grep -qx $app || bench --site SITE install-app $app || echo "INSTALL FAILED $app"
done

bench --site SITE migrate && bench --site SITE clear-cache
sudo supervisorctl status                      # find this bench's web and worker groups
sudo supervisorctl restart <web group> <worker groups>   # name them; never restart everything
```

Then:

```
bench --site SITE set-config health_simulation_allowed 1
bench --site SITE execute alaiy_os.health.simulate.demo
```

Open `/app/connector-health` as a System Manager. `demo` gives every function of every connector with a health list
a scenario (mostly healthy, with every problem shown), turns on the connector, its interval and its function switch where
they are off, and reports what it could not simulate. Connectors whose settings were never saved show as config invalid
until their settings are saved once.

Single scenarios and clean-up:

```
bench --site SITE execute alaiy_os.health.simulate.run --kwargs "{'scenario': 'overdue'}"
bench --site SITE execute alaiy_os.health.simulate.break_interval --kwargs "{'value': '30'}"
bench --site SITE execute alaiy_os.health.simulate.cleanup
bench --site SITE set-config health_simulation_allowed 0
```

`run` takes `scenario`, and optionally `connector_id`, `function_key` and `alerts` (1 also stores state and posts to
Slack like the 5-minute job). `break_interval` sets the interval to a value (`'30'` gives config invalid, `'Disabled'`
gives disabled). `cleanup` deletes the rows and restores every setting that was changed.

| Scenario | State |
|---|---|
| `healthy` | healthy |
| `overdue` | overdue |
| `failing_all_items` | failing (the run is marked success, every item failed) |
| `failing_runs` | failing (three failed runs; the page must show the error without the token) |
| `zero_rows` | warning |
| `skipped_rows` | warning |
| `stuck` | stuck |
