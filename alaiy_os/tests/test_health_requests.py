# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Request-log functions: connectors that have no runs, only a log of calls.

A read-through connector makes calls on demand and logs each one. Health for it is the last hour of
those calls: how many, how many failed, how slow, and when one last worked.
"""

import sys
import types
import unittest
from datetime import datetime, timedelta

from alaiy_os.health.contract import normalise_health
from alaiy_os.health.engine import compute_request_state
from alaiy_os.health.runs import read_requests

NOW = datetime(2026, 11, 18, 12, 0, 0)
ENTRY = {"key": "calls", "label": "API calls", "direction": "pull"}
LOG = {"key": "calls", "label": "API calls", "kind": "requests", "log_doctype": "Some Request Log"}


def req(minutes_ago, status="success", ms=100, error=""):
    return {"status": status, "at": NOW - timedelta(minutes=minutes_ago), "duration_ms": ms, "error": error}


def state(rows, last_ok=None, last_err=None, enabled=True, **fn):
    return compute_request_state({**ENTRY, **fn}, rows, NOW, last_success_at=last_ok, last_error=last_err, connector_enabled=enabled)


class ContractTests(unittest.TestCase):
    def test_a_request_entry_needs_no_schedule_or_interval(self):
        entry = normalise_health([LOG])[0]
        self.assertEqual((entry["kind"], entry["scheduled"]), ("requests", False))
        self.assertEqual((entry["window_min"], entry["min_requests"]), (60, 5))

    def test_the_kind_must_be_runs_or_requests(self):
        with self.assertRaises(ValueError):
            normalise_health([{**LOG, "kind": "stream"}])
        self.assertEqual(normalise_health([{**LOG, "kind": "runs", "interval_setting": "i"}])[0]["kind"], "runs")

    def test_the_window_and_minimum_are_sensible(self):
        for bad in ({"window_min": 1}, {"window_min": "hour"}, {"min_requests": 0}):
            with self.assertRaises(ValueError, msg=str(bad)):
                normalise_health([{**LOG, **bad}])

    def test_the_rates_are_fractions_with_warn_not_above_fail(self):
        for bad in ({"error_warn_rate": 1.5}, {"error_fail_rate": -0.1}, {"error_warn_rate": 0.6, "error_fail_rate": 0.5}):
            with self.assertRaises(ValueError, msg=str(bad)):
                normalise_health([{**LOG, **bad}])
        ok = normalise_health([{**LOG, "error_warn_rate": 0.2, "error_fail_rate": 0.8}])[0]
        self.assertEqual((ok["error_warn_rate"], ok["error_fail_rate"]), (0.2, 0.8))

    def test_duration_is_a_field_only_a_request_log_can_map(self):
        self.assertEqual(normalise_health([{**LOG, "fields": {"duration": "duration_ms"}}])[0]["fields"]["duration"], "duration_ms")
        with self.assertRaises(ValueError):
            normalise_health([{"key": "a", "label": "A", "log_doctype": "L", "interval_setting": "i", "fields": {"duration": "d"}}])

    def test_error_statuses_are_a_list_of_words(self):
        self.assertEqual(normalise_health([{**LOG, "error_statuses": ["failed", "rejected"]}])[0]["error_statuses"], ["failed", "rejected"])
        with self.assertRaises(ValueError):
            normalise_health([{**LOG, "error_statuses": "failed"}])

    def test_a_log_kept_by_another_app_can_be_marked(self):
        self.assertTrue(normalise_health([{**LOG, "log_external": True}])[0]["log_external"])


class EngineTests(unittest.TestCase):
    def test_no_requests_is_no_data_not_healthy(self):
        result = state([])
        self.assertEqual(result["state"], "no_data")
        self.assertIn("60 minutes", result["reason"])

    def test_the_last_success_is_shown_even_when_it_is_older_than_the_window(self):
        result = state([], last_ok=NOW - timedelta(hours=5))
        self.assertEqual((result["state"], result["lag_minutes"]), ("no_data", 300))

    def test_all_good_is_healthy_with_the_counts(self):
        result = state([req(i) for i in range(10)])
        self.assertEqual(result["state"], "healthy")
        self.assertEqual(result["last_counts"], {"processed": 10, "changed": 10, "failed": 0, "skipped": 0})
        self.assertEqual((result["runs_24h"], result["failures_24h"], result["requests"]), (10, 0, 10))

    def test_the_thresholds_are_inclusive_and_apply_at_the_minimum_count(self):
        ten = lambda errors: [req(i, status="failed" if i < errors else "success") for i in range(10)]
        self.assertEqual(state(ten(0))["state"], "healthy")
        self.assertEqual(state(ten(1))["state"], "warning")     # 10%
        self.assertEqual(state(ten(4))["state"], "warning")
        self.assertEqual(state(ten(5))["state"], "failing")     # 50%
        self.assertEqual(state(ten(10))["state"], "failing")

    def test_too_few_requests_to_judge_only_warn_when_something_failed(self):
        self.assertEqual(state([req(1), req(2), req(3)])["state"], "healthy")
        warned = state([req(1, status="failed"), req(2), req(3)])
        self.assertEqual(warned["state"], "warning")
        self.assertIn("too few", warned["reason"])

    def test_the_rates_can_be_overridden_per_function(self):
        rows = [req(i, status="failed" if i < 5 else "success") for i in range(10)]
        self.assertEqual(state(rows, error_fail_rate=0.9)["state"], "warning")
        self.assertEqual(state(rows, error_warn_rate=0.9, error_fail_rate=0.9)["state"], "healthy")

    def test_the_minimum_can_be_overridden(self):
        rows = [req(1, status="failed"), req(2, status="failed")]
        self.assertEqual(state(rows, min_requests=2)["state"], "failing")

    def test_which_statuses_are_errors_can_be_set(self):
        rows = [req(i, status="rejected") for i in range(10)]
        self.assertEqual(state(rows)["state"], "healthy")
        self.assertEqual(state(rows, error_statuses=["rejected"])["state"], "failing")

    def test_status_words_match_whatever_their_case(self):
        rows = [req(i, status="Failed") for i in range(10)]
        self.assertEqual(state(rows)["state"], "failing")

    def test_a_disabled_connector_is_disabled(self):
        self.assertEqual(state([req(1, status="failed")] * 10, enabled=False)["state"], "disabled")

    def test_latency_uses_the_nearest_rank_for_the_95th_percentile(self):
        rows = [req(i, ms=100) for i in range(19)] + [req(19, ms=2000)]
        result = state(rows)
        self.assertEqual((result["latency_avg_ms"], result["latency_p95_ms"]), (195, 100))

    def test_missing_durations_give_no_latency(self):
        result = state([req(i, ms=None) for i in range(6)])
        self.assertEqual((result["latency_avg_ms"], result["latency_p95_ms"]), (None, None))

    def test_the_error_rate_and_streak_are_reported(self):
        rows = [req(1, status="failed"), req(2, status="failed"), req(3), req(4), req(5), req(6, status="failed")]
        result = state(rows)
        self.assertEqual(result["consecutive_failures"], 2)
        self.assertAlmostEqual(result["error_rate"], 0.5)

    def test_the_last_error_is_scrubbed_and_reduced_to_the_exception_line(self):
        err = "Traceback (most recent call last):\n  File x\nConnectionError: refused token=abc123secret"
        out = state([req(1)] * 5, last_err=err)["last_error"]
        self.assertTrue(out.startswith("ConnectionError: refused"))
        self.assertNotIn("abc123secret", out)

    def test_the_window_is_reported(self):
        self.assertEqual(state([req(1)] * 5, window_min=30)["window_minutes"], 30)
        self.assertEqual(state([req(1)] * 5)["kind"], "requests")


class ReadRequestsTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        outer = self
        frappe = types.ModuleType("frappe")

        class Meta:
            def has_field(self, name):
                return name in {"outcome", "duration_ms", "api_message", "context"}

        frappe.get_meta = lambda doctype: Meta()
        replies = [
            [{"outcome": "Success", "creation": NOW - timedelta(minutes=5), "duration_ms": 120, "api_message": ""},
             {"outcome": "Failed", "creation": NOW - timedelta(minutes=9), "duration_ms": 900, "api_message": "boom"}],
            [NOW - timedelta(minutes=5)],
            [{"api_message": "boom"}],
        ]
        frappe.get_all = lambda doctype, **kw: outer.calls.append((doctype, kw)) or replies[len(outer.calls) - 1]
        self.saved = sys.modules.get("frappe")
        sys.modules["frappe"] = frappe

    def tearDown(self):
        if self.saved is None:
            sys.modules.pop("frappe", None)
        else:
            sys.modules["frappe"] = self.saved

    def entry(self, **extra):
        return {"log_doctype": "Some Request Log", "log_filter": {"context": "search", "x": ["!=", "y"]}, "window_min": 60,
                "fields": {"status": "outcome", "duration": "duration_ms", "error": "api_message"}, **extra}

    def test_rows_last_success_and_last_error_come_back(self):
        rows, last_ok, last_err = read_requests(self.entry(), NOW)
        self.assertEqual([r["status"] for r in rows], ["success", "failed"])
        self.assertEqual((rows[0]["duration_ms"], rows[1]["error"]), (120, "boom"))
        self.assertEqual(last_ok, NOW - timedelta(minutes=5))
        self.assertEqual(last_err, "boom")

    def test_the_window_query_is_bounded_newest_first_and_filtered_by_time(self):
        read_requests(self.entry(), NOW)
        doctype, kw = self.calls[0]
        self.assertEqual((doctype, kw["limit"], kw["order_by"]), ("Some Request Log", 1000, "creation desc"))
        self.assertIn(["creation", ">=", NOW - timedelta(minutes=60)], kw["filters"])
        self.assertIn(["context", "=", "search"], kw["filters"])
        self.assertIn(["x", "!=", "y"], kw["filters"])

    def test_the_last_success_ignores_the_window_and_excludes_error_statuses(self):
        read_requests(self.entry(), NOW)
        kw = self.calls[1][1]
        self.assertEqual(kw["limit"], 1)
        self.assertIn(["outcome", "not in", ["error", "errored", "failed", "failure"]], kw["filters"])
        self.assertFalse(any(f[0] == "creation" for f in kw["filters"]))

    def test_the_last_error_uses_the_error_statuses(self):
        read_requests(self.entry(error_statuses=["Failed", "Rejected"]), NOW)
        kw = self.calls[2][1]
        self.assertIn(["outcome", "in", ["failed", "rejected"]], kw["filters"])

    def test_only_fields_the_log_has_are_requested(self):
        read_requests(self.entry(), NOW)
        fields = self.calls[0][1]["fields"]
        self.assertIn("duration_ms", fields)
        self.assertNotIn("nope", fields)


if __name__ == "__main__":
    unittest.main()
