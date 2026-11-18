# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Scenarios for trying Connector Health on a build site.

Each scenario is a set of synthetic run records. The test that matters: feed each one through the
real state engine and get the state the scenario is named for, at every interval a connector uses.
"""

import unittest
from datetime import datetime

from alaiy_os.health.engine import compute_state
from alaiy_os.health.simulate import EXPECTED, SCENARIOS, build_rows, log_values

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
