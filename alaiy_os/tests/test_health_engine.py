# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""State rules for connector health. Plain Python: no bench, no database.

Each test is one way a sync can go wrong without anyone noticing, and pins what the page must say.
"""

import unittest
from datetime import datetime, timedelta

from alaiy_os.health.engine import (
    ALERT_STATES, DISABLED, FAILING, HEALTHY, INVALID, NO_DATA, OVERDUE, STUCK, WARNING, compute_state, worst,
)
from alaiy_os.health.intervals import parse_interval

NOW = datetime(2026, 11, 18, 12, 0, 0)
FN = {"key": "stock", "label": "Stock sync", "direction": "pull", "interval_setting": "cs_stock_sync_interval"}


def run(minutes_ago, status="success", processed=100, failed=0, skipped=0, error="", took=2):
    start = NOW - timedelta(minutes=minutes_ago)
    return {
        "status": status, "started_at": start, "finished_at": start + timedelta(minutes=took),
        "processed": processed, "changed": processed - failed, "failed": failed, "skipped": skipped, "error": error,
    }


def state(runs, interval="30 min", enabled=True, **fn):
    return compute_state({**FN, **fn}, runs, NOW, interval_raw=interval, connector_enabled=enabled)


class IntervalTests(unittest.TestCase):
    def test_accepted_values(self):
        self.assertEqual(parse_interval("30 min").minutes, 30)
        self.assertEqual(parse_interval("1 hour").minutes, 60)
        self.assertEqual(parse_interval("6 hours").minutes, 360)
        self.assertEqual(parse_interval("1 day").minutes, 1440)

    def test_off_values_are_disabled(self):
        for value in ("Disabled", "", None):
            self.assertEqual(parse_interval(value).kind, "disabled")

    def test_word_intervals_some_connectors_use(self):
        for word, minutes in (("Hourly", 60), ("Daily", 1440), ("Weekly", 10080), ("hourly", 60)):
            self.assertEqual(parse_interval(word).minutes, minutes, word)

    def test_a_bare_number_is_minutes_only_when_the_connector_says_so(self):
        self.assertEqual(parse_interval("30", bare_unit="min").minutes, 30)
        self.assertEqual(parse_interval("2", bare_unit="hour").minutes, 120)
        self.assertEqual(parse_interval("1", bare_unit="day").minutes, 1440)
        self.assertEqual(parse_interval("soon", bare_unit="min").kind, "invalid")
        self.assertEqual(parse_interval("30 min", bare_unit="hour").minutes, 30)  # a stated unit wins

    def test_a_bare_number_is_invalid_not_disabled(self):
        # "30" saved instead of "30 min" once stopped a sync for 17 hours because it read as off.
        for value in ("30", "30 mins ago", "soon", "0 min"):
            self.assertEqual(parse_interval(value).kind, "invalid", value)


class StateTests(unittest.TestCase):
    def test_recent_success_is_healthy(self):
        self.assertEqual(state([run(10), run(40)])["state"], HEALTHY)

    def test_no_runs_is_never_healthy(self):
        self.assertEqual(state([])["state"], NO_DATA)

    def test_scheduler_stopped_goes_overdue_after_three_intervals(self):
        self.assertEqual(state([run(85)])["state"], HEALTHY)   # 85 < 90
        self.assertEqual(state([run(95)])["state"], OVERDUE)   # 95 > 3 x 30

    def test_short_interval_has_a_floor(self):
        # 3 x 1 minute would alarm on any queue delay; nothing is overdue before 15 minutes.
        self.assertEqual(state([run(10)], interval="1 min")["state"], HEALTHY)
        self.assertEqual(state([run(20)], interval="1 min")["state"], OVERDUE)

    def test_bare_minutes_read_when_the_function_declares_the_unit(self):
        self.assertEqual(state([run(10)], interval="30", interval_unit="min")["state"], HEALTHY)
        self.assertEqual(state([run(200)], interval="30", interval_unit="min")["state"], OVERDUE)
        self.assertEqual(state([run(10)], interval="30")["state"], INVALID)

    def test_a_function_switched_off_in_settings_is_disabled_not_overdue(self):
        result = compute_state({**FN}, [run(500)], NOW, interval_raw="30 min", function_enabled=False)
        self.assertEqual(result["state"], DISABLED)
        self.assertIn("switched off", result["reason"])

    def test_disabled_and_invalid_interval(self):
        self.assertEqual(state([run(10)], interval="Disabled")["state"], DISABLED)
        self.assertEqual(state([run(10)], enabled=False)["state"], DISABLED)
        self.assertEqual(state([run(10)], interval="30")["state"], INVALID)

    def test_every_item_failing_is_failing_even_when_marked_success(self):
        self.assertEqual(state([run(10, processed=1319, failed=1319)])["state"], FAILING)

    def test_failure_ratio_needs_enough_rows(self):
        self.assertEqual(state([run(10, processed=2, failed=1)])["state"], HEALTHY)
        self.assertEqual(state([run(10, processed=200, failed=20)])["state"], FAILING)

    def test_three_failed_runs_fail_one_does_not(self):
        three = [run(10, "failed", 0), run(40, "failed", 0), run(70, "failed", 0)]
        self.assertEqual(state(three)["state"], FAILING)
        self.assertEqual(state([run(10, "failed", 0), run(40)])["state"], HEALTHY)

    def test_remote_401_shows_the_error(self):
        runs = [run(m, "failed", 0, error="401 Unauthorized\ntraceback...") for m in (10, 40, 70)]
        result = state(runs)
        self.assertEqual(result["state"], FAILING)
        self.assertEqual(result["last_error"], "401 Unauthorized")

    def test_stuck_run(self):
        stuck = {**run(130), "status": "running", "finished_at": None}
        result = state([stuck, run(200)])
        self.assertEqual(result["state"], STUCK)
        self.assertEqual(result["running_minutes"], 130)
        self.assertEqual(state([{**run(30), "status": "running", "finished_at": None}, run(60)])["state"], HEALTHY)

    def test_per_function_runtime_limit(self):
        slow = {**run(130), "status": "running", "finished_at": None}
        self.assertEqual(state([slow, run(200)], interval="1 day", max_runtime_min=240)["state"], HEALTHY)
        self.assertEqual(state([slow, run(200)], interval="1 day")["state"], STUCK)

    def test_zero_rows_three_times_is_a_warning_only_when_rows_are_expected(self):
        zero = [run(10, processed=0), run(40, processed=0), run(70, processed=0)]
        self.assertEqual(state(zero)["state"], WARNING)
        self.assertEqual(state(zero, expects_rows=False)["state"], HEALTHY)

    def test_unset_overrides_fall_back_to_the_defaults(self):
        # A registry entry carries None for every override it does not set.
        unset = dict(overdue_factor=None, overdue_floor_min=None, max_runtime_min=None)
        self.assertEqual(state([run(10)], **unset)["state"], HEALTHY)
        self.assertEqual(state([run(95)], **unset)["state"], OVERDUE)

    def test_one_or_two_empty_runs_are_not_yet_a_warning(self):
        self.assertEqual(state([run(10, processed=0), run(40)])["state"], HEALTHY)
        self.assertEqual(state([run(10, processed=0), run(40, processed=0), run(70)])["state"], HEALTHY)

    def test_a_small_run_where_every_item_failed_is_failing(self):
        self.assertEqual(state([run(10, processed=3, failed=3)])["state"], FAILING)

    def test_skipped_rows_warn(self):
        self.assertEqual(state([run(10, skipped=5)])["state"], WARNING)

    def test_a_run_skipped_because_another_was_active_is_not_a_run(self):
        # Some connectors log status "skipped" when the previous run is still going. It must not
        # warn, break a failure streak, or hide the real last run.
        self.assertEqual(state([run(2, "skipped", 0), run(10)])["state"], HEALTHY)
        three = [run(2, "skipped", 0), run(10, "failed", 0), run(40, "failed", 0), run(70, "failed", 0)]
        self.assertEqual(state(three)["state"], FAILING)
        self.assertEqual(state([run(2, "skipped", 0), run(95)])["state"], OVERDUE)

    def test_never_succeeded_is_overdue_only_after_the_limit(self):
        self.assertEqual(state([run(10, "failed", 0)])["state"], HEALTHY)
        self.assertEqual(state([run(10, "failed", 0), run(130, "failed", 0)])["state"], OVERDUE)

    def test_on_demand_function_is_never_overdue(self):
        self.assertEqual(state([run(100000)], interval=None, scheduled=False, interval_setting=None)["state"], HEALTHY)

    def test_twenty_four_hour_counts(self):
        result = state([run(10), run(40, "failed", 0), run(2000)])
        self.assertEqual((result["runs_24h"], result["failures_24h"]), (2, 1))

    def test_the_states_that_alert_include_an_invalid_interval(self):
        # An interval the sync cannot read stops it silently, the same outage as a stopped scheduler.
        self.assertEqual(ALERT_STATES, {OVERDUE, STUCK, FAILING, INVALID})

    def test_worst_state_wins(self):
        self.assertEqual(worst([HEALTHY, OVERDUE, WARNING]), OVERDUE)
        self.assertEqual(worst([HEALTHY, STUCK, FAILING]), STUCK)
        self.assertEqual(worst([]), NO_DATA)


if __name__ == "__main__":
    unittest.main()
