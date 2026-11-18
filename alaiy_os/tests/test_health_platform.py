# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Decisions behind the platform checks: scheduler, workers, disk, queue backlog.

The probes that touch Frappe and Redis are thin; the decision each makes lives in a plain function
tested here.
"""

import unittest
from datetime import datetime, timedelta

from alaiy_os.health.platform import backlog_state, disk_state, error_log_state, scheduler_state, workers_state

NOW = datetime(2026, 11, 18, 12, 0, 0)


class SchedulerTests(unittest.TestCase):
    def test_a_paused_or_disabled_scheduler_is_red_with_its_reason(self):
        result = scheduler_state("pause_scheduler is set", NOW, NOW)
        self.assertEqual(result["state"], "red")
        self.assertIn("pause_scheduler", result["detail"])

    def test_a_recent_job_run_is_ok(self):
        self.assertEqual(scheduler_state(None, NOW - timedelta(minutes=5), NOW)["state"], "ok")

    def test_silence_over_ten_minutes_is_red(self):
        self.assertEqual(scheduler_state(None, NOW - timedelta(minutes=11), NOW)["state"], "red")

    def test_a_dormant_site_is_only_a_warning(self):
        self.assertEqual(scheduler_state(None, NOW - timedelta(minutes=11), NOW, dormant=True)["state"], "warn")

    def test_no_job_has_ever_run_is_red(self):
        self.assertEqual(scheduler_state(None, None, NOW)["state"], "red")


class WorkerTests(unittest.TestCase):
    def test_all_three_queues_served_is_ok(self):
        workers = [["bench:default", "bench:short"], ["bench:long"]]
        self.assertEqual(workers_state(workers)["state"], "ok")

    def test_a_missing_queue_is_red_and_named(self):
        result = workers_state([["bench:default", "bench:short"]])
        self.assertEqual(result["state"], "red")
        self.assertIn("long", result["detail"])

    def test_no_workers_at_all_is_red(self):
        self.assertEqual(workers_state([])["state"], "red")

    def test_a_queue_name_must_match_exactly_not_by_substring(self):
        self.assertEqual(workers_state([["bench:default", "bench:short", "bench:longer"]])["state"], "red")


class DiskTests(unittest.TestCase):
    def test_below_the_threshold_is_red(self):
        self.assertEqual(disk_state(1000, 149)["state"], "red")

    def test_close_to_the_threshold_warns(self):
        self.assertEqual(disk_state(1000, 200)["state"], "warn")

    def test_plenty_free_is_ok(self):
        self.assertEqual(disk_state(1000, 300)["state"], "ok")

    def test_exactly_the_threshold_is_not_red(self):
        self.assertNotEqual(disk_state(1000, 150)["state"], "red")

    def test_an_unreadable_disk_is_unknown_not_ok(self):
        self.assertEqual(disk_state(0, 0)["state"], "unknown")


class BacklogTests(unittest.TestCase):
    def test_small_queues_are_ok(self):
        self.assertEqual(backlog_state({"default": 3, "short": 0, "long": 1})["state"], "ok")

    def test_the_thresholds_are_inclusive(self):
        self.assertEqual(backlog_state({"default": 200})["state"], "warn")
        self.assertEqual(backlog_state({"default": 199})["state"], "ok")
        self.assertEqual(backlog_state({"default": 1000})["state"], "red")

    def test_the_worst_queue_decides(self):
        self.assertEqual(backlog_state({"default": 250, "short": 0})["state"], "warn")
        result = backlog_state({"default": 5, "long": 1500})
        self.assertEqual(result["state"], "red")
        self.assertIn("long", result["detail"])


class ErrorLogTests(unittest.TestCase):
    def test_no_errors_is_ok(self):
        self.assertEqual(error_log_state({})["state"], "ok")
        self.assertEqual(error_log_state({"alpha": 0, "beta": 0})["state"], "ok")

    def test_the_thresholds_are_inclusive(self):
        self.assertEqual(error_log_state({"alpha": 19})["state"], "ok")
        self.assertEqual(error_log_state({"alpha": 20})["state"], "warn")
        self.assertEqual(error_log_state({"alpha": 99})["state"], "warn")
        self.assertEqual(error_log_state({"alpha": 100})["state"], "red")

    def test_the_noisiest_connectors_are_named_worst_first_up_to_three(self):
        result = error_log_state({"a": 5, "b": 60, "c": 30, "d": 45, "e": 0})
        self.assertEqual(result["detail"], "b 60, d 45, c 30 in the last hour")

    def test_the_worst_connector_decides_the_state(self):
        self.assertEqual(error_log_state({"a": 150, "b": 1})["state"], "red")

    def test_a_quiet_hour_says_so(self):
        self.assertIn("No connector errors", error_log_state({"a": 3})["detail"] if False else error_log_state({})["detail"])

    def test_a_few_errors_below_the_threshold_are_still_named(self):
        result = error_log_state({"a": 3})
        self.assertEqual((result["state"], result["detail"]), ("ok", "a 3 in the last hour"))


if __name__ == "__main__":
    unittest.main()
