# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Scenarios for trying Connector Health on a build site.

Each scenario is a set of synthetic run records. The test that matters: feed each one through the
real state engine and get the state the scenario is named for, at every interval a connector uses.
"""

import unittest
from datetime import datetime

from alaiy_os.health.engine import compute_state
from alaiy_os.health.simulate import EXPECTED, SCENARIOS, build_rows, fits, interfering, log_values, plan_demo, status_value

NOW = datetime(2026, 11, 18, 12, 0, 0)
ENTRY = {"key": "stock", "label": "Stock", "interval_setting": "stock_interval"}


class ScenarioTests(unittest.TestCase):
    def test_every_scenario_ends_in_the_state_it_is_named_for(self):
        for interval in (5, 30, 60, 1440):
            for scenario in SCENARIOS:
                rows = build_rows(scenario, interval, NOW)
                state = compute_state(ENTRY, rows, NOW, interval_raw=f"{interval} min")["state"]
                self.assertEqual(state, EXPECTED[scenario], f"{scenario} at {interval} min")

    def test_the_failure_scenarios_are_what_they_say(self):
        every = build_rows("failing_all_items", 30, NOW)[0]
        self.assertEqual(every["failed"], every["processed"])
        self.assertEqual(every["status"], "success")  # the connector called it a success
        runs = build_rows("failing_runs", 30, NOW)
        self.assertEqual([r["status"] for r in runs], ["failed"] * 3)

    def test_rows_are_newest_first(self):
        for scenario in SCENARIOS:
            starts = [r["started_at"] for r in build_rows(scenario, 30, NOW)]
            self.assertEqual(starts, sorted(starts, reverse=True), scenario)

    def test_an_unknown_scenario_is_refused(self):
        with self.assertRaises(ValueError):
            build_rows("lunar_eclipse", 30, NOW)


class FitsTests(unittest.TestCase):
    FULL = {"scheduled": True, "expects_rows": True, "can_skip": True}

    def test_everything_fits_a_full_function(self):
        self.assertTrue(all(fits(s, self.FULL) for s in SCENARIOS))

    def test_overdue_needs_a_schedule(self):
        self.assertFalse(fits("overdue", {**self.FULL, "scheduled": False}))

    def test_zero_rows_needs_a_function_that_expects_rows(self):
        self.assertFalse(fits("zero_rows", {**self.FULL, "expects_rows": False}))

    def test_skipped_rows_needs_a_log_that_records_skips(self):
        self.assertFalse(fits("skipped_rows", {**self.FULL, "can_skip": False}))


class DemoPlanTests(unittest.TestCase):
    FULL = {"scheduled": True, "expects_rows": True, "can_skip": True}

    def test_a_demo_of_ten_or_more_functions_shows_every_scenario(self):
        plan = plan_demo([self.FULL] * 12)
        self.assertEqual(len(plan), 12)
        self.assertEqual(set(plan), set(SCENARIOS))

    def test_most_of_a_demo_is_healthy_so_the_page_reads_like_a_real_one(self):
        plan = plan_demo([self.FULL] * 20)
        self.assertGreater(plan.count("healthy"), len(plan) / 3)

    def test_no_function_is_given_a_scenario_it_cannot_show(self):
        infos = [
            {"scheduled": False, "expects_rows": False, "can_skip": False},
            {"scheduled": True, "expects_rows": False, "can_skip": True},
            {"scheduled": True, "expects_rows": True, "can_skip": False},
        ] * 8
        for info, scenario in zip(infos, plan_demo(infos)):
            self.assertTrue(fits(scenario, info), (info, scenario))

    def test_the_plan_is_the_same_every_time(self):
        self.assertEqual(plan_demo([self.FULL] * 15), plan_demo([self.FULL] * 15))

    def test_nothing_to_plan_is_an_empty_plan(self):
        self.assertEqual(plan_demo([]), [])


class InterferingTests(unittest.TestCase):
    OLDEST = datetime(2026, 11, 18, 8, 0, 0)

    def test_real_rows_newer_than_the_oldest_synthetic_one_would_override_it(self):
        rows = [("new", datetime(2026, 11, 18, 11, 0, 0)), ("same", self.OLDEST), ("old", datetime(2026, 11, 17, 9, 0, 0))]
        self.assertEqual(interfering(rows, self.OLDEST), ["new", "same"])

    def test_a_row_with_no_time_is_left_alone(self):
        self.assertEqual(interfering([("blank", None)], self.OLDEST), [])

    def test_nothing_to_park_when_the_log_is_empty(self):
        self.assertEqual(interfering([], self.OLDEST), [])


class StatusValueTests(unittest.TestCase):
    def test_a_log_with_lowercase_options_gets_the_plain_words(self):
        options = ["queued", "running", "success", "failed"]
        self.assertEqual([status_value(s, options) for s in ("running", "success", "failed")], ["running", "success", "failed"])

    def test_a_log_with_its_own_words_gets_the_matching_option(self):
        options = ["Queued", "Running", "Done", "Partial", "Failed"]
        self.assertEqual(status_value("success", options), "Done")
        self.assertEqual(status_value("failed", options), "Failed")
        self.assertEqual(status_value("running", options), "Running")

    def test_completed_counts_as_success(self):
        self.assertEqual(status_value("success", ["Pending", "Completed", "Error"]), "Completed")
        self.assertEqual(status_value("failed", ["Pending", "Completed", "Error"]), "Error")

    def test_a_status_the_log_cannot_hold_is_not_guessed(self):
        self.assertIsNone(status_value("running", ["Open", "Closed"]))

    def test_no_options_means_the_plain_word(self):
        self.assertEqual(status_value("success", []), "success")


class LogValuesTests(unittest.TestCase):
    ROW = {"status": "failed", "started_at": NOW, "finished_at": NOW, "processed": 7, "changed": 3,
           "failed": 4, "skipped": 1, "error": "boom"}

    def test_standard_names_map_onto_the_logs_own_fields(self):
        entry = {"fields": {"processed": "items_processed", "changed": ["items_created", "items_updated"],
                            "failed": "items_failed", "error": "error_message"}, "log_filter": {}}
        values = log_values(self.ROW, entry)
        self.assertEqual((values["items_processed"], values["items_created"], values["items_failed"]), (7, 3, 4))
        self.assertEqual(values["error_message"], "boom")
        self.assertNotIn("items_updated", values)

    def test_the_log_filter_values_are_written_so_the_row_belongs_to_the_function(self):
        entry = {"fields": {}, "log_filter": {"sync_type": "stock", "trigger": ["!=", "webhook"]}}
        values = log_values(self.ROW, entry)
        self.assertEqual(values["sync_type"], "stock")
        self.assertNotIn("trigger", values)  # an operator filter is not a value to write

    def test_a_running_row_has_no_finish_time(self):
        values = log_values({**self.ROW, "status": "running", "finished_at": None}, {"fields": {}, "log_filter": {}})
        self.assertIsNone(values["finished_at"])


if __name__ == "__main__":
    unittest.main()
