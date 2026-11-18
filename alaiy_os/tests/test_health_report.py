# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""The JSON that dashboards and other instances read: stable shape, ISO timestamps, no surprises.

A consumer outside Frappe cannot be expected to parse Frappe's datetime format or to guess a missing
key, so the shapes are pinned here.
"""

import json
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from alaiy_os.health.report import (
    SCHEMA, connector_payload, fresh, full_payload, jsonable, overall, summary_payload,
)

NOW = datetime(2026, 11, 18, 12, 0, 0)
IST = ZoneInfo("Asia/Kolkata")


def fn(key, state, **extra):
    return {"key": key, "label": key.title(), "state": state, "reason": "", "last_error": "",
            "last_success_at": datetime(2026, 11, 18, 11, 0, 0), "lag_minutes": 60, "consecutive_failures": 0,
            "log_doctype": "Some Log", **extra}


def collected(platform_state="ok", states=("healthy", "failing", "warning", "healthy")):
    return {
        "checked_at": NOW,
        "platform": [{"key": "disk", "label": "Disk space", "state": platform_state, "detail": "40% free"}],
        "connectors": [
            {"connector_id": "alpha", "connector_name": "Alpha", "state": "failing", "has_contract": True,
             "operations": [], "can_test": True,
             "functions": [fn(f"f{i}", state) for i, state in enumerate(states)]},
            {"connector_id": "beta", "connector_name": "Beta", "state": "no_contract", "has_contract": False,
             "operations": [], "can_test": False, "functions": []},
        ],
    }


class JsonableTests(unittest.TestCase):
    def test_datetimes_become_iso_strings_with_the_site_offset(self):
        self.assertEqual(jsonable(NOW, IST), "2026-11-18T12:00:00+05:30")

    def test_without_a_timezone_the_time_is_plain_iso(self):
        self.assertEqual(jsonable(NOW), "2026-11-18T12:00:00")

    def test_it_reaches_inside_dicts_lists_and_tuples(self):
        out = jsonable({"a": [NOW, {"b": (NOW,)}]}, IST)
        self.assertEqual(out["a"][0], "2026-11-18T12:00:00+05:30")
        self.assertEqual(out["a"][1]["b"], ["2026-11-18T12:00:00+05:30"])

    def test_the_result_is_always_serialisable(self):
        json.dumps(jsonable(full_payload(collected(), "site-one", NOW), IST))

    def test_other_values_pass_through(self):
        self.assertEqual(jsonable({"n": 1, "s": "x", "none": None, "t": True}), {"n": 1, "s": "x", "none": None, "t": True})


class OverallTests(unittest.TestCase):
    def test_a_failing_function_makes_it_critical(self):
        self.assertEqual(overall(collected()), "critical")

    def test_each_critical_state(self):
        for state in ("failing", "stuck", "overdue", "config_invalid"):
            self.assertEqual(overall(collected(states=("healthy", state))), "critical", state)

    def test_a_warning_alone_is_a_warning(self):
        self.assertEqual(overall(collected(states=("healthy", "warning"))), "warning")

    def test_a_red_platform_check_is_critical_and_a_warn_one_is_a_warning(self):
        self.assertEqual(overall(collected(platform_state="red", states=("healthy",))), "critical")
        self.assertEqual(overall(collected(platform_state="warn", states=("healthy",))), "warning")

    def test_healthy_disabled_and_no_data_are_ok(self):
        self.assertEqual(overall(collected(states=("healthy", "disabled", "no_data"))), "ok")

    def test_nothing_to_report_is_ok(self):
        self.assertEqual(overall({"platform": [], "connectors": []}), "ok")


class SummaryTests(unittest.TestCase):
    def setUp(self):
        self.summary = summary_payload(collected(), "site-one", NOW)

    def test_it_identifies_the_instance_and_the_schema(self):
        self.assertEqual((self.summary["schema"], self.summary["instance"]), (SCHEMA, "site-one"))
        self.assertEqual(self.summary["generated_at"], NOW)

    def test_counts_include_every_state_even_at_zero(self):
        counts = self.summary["counts"]
        for state in ("healthy", "warning", "failing", "overdue", "stuck", "config_invalid", "no_data", "disabled"):
            self.assertIn(state, counts)
        self.assertEqual((counts["healthy"], counts["failing"], counts["warning"], counts["stuck"]), (2, 1, 1, 0))
        self.assertEqual((self.summary["total"], self.summary["attention"]), (4, 2))

    def test_problems_are_the_functions_that_need_attention_worst_first(self):
        problems = self.summary["problems"]
        self.assertEqual([p["state"] for p in problems], ["failing", "warning"])
        self.assertEqual(problems[0]["connector_id"], "alpha")
        for key in ("connector_name", "function_key", "function", "reason", "last_error", "last_success_at", "lag_minutes"):
            self.assertIn(key, problems[0])

    def test_problems_follow_the_severity_order_whatever_the_input_order(self):
        data = collected(states=("warning", "overdue", "stuck", "healthy", "failing", "config_invalid"))
        order = [p["state"] for p in summary_payload(data, "site-one", NOW)["problems"]]
        self.assertEqual(order, ["stuck", "failing", "overdue", "config_invalid", "warning"])

    def test_connectors_are_listed_with_their_function_count_and_contract(self):
        by_id = {c["connector_id"]: c for c in self.summary["connectors"]}
        self.assertEqual((by_id["alpha"]["functions"], by_id["alpha"]["has_contract"]), (4, True))
        self.assertEqual((by_id["beta"]["functions"], by_id["beta"]["state"]), (0, "no_contract"))

    def test_the_platform_checks_and_overall_are_included(self):
        self.assertEqual(self.summary["overall"], "critical")
        self.assertEqual(self.summary["platform"][0]["key"], "disk")

    def test_it_is_small_no_per_function_detail_beyond_problems(self):
        self.assertNotIn("functions", self.summary)


class FullAndConnectorTests(unittest.TestCase):
    def test_the_full_report_keeps_the_collected_data_and_adds_the_envelope(self):
        report = full_payload(collected(), "site-one", NOW)
        self.assertEqual((report["schema"], report["instance"], report["overall"]), (SCHEMA, "site-one", "critical"))
        self.assertEqual(len(report["connectors"][0]["functions"]), 4)
        self.assertIn("platform", report)

    def test_one_connector_with_the_envelope(self):
        payload = connector_payload(collected(), "alpha", "site-one", NOW)
        self.assertEqual(payload["connector"]["connector_id"], "alpha")
        self.assertEqual(payload["instance"], "site-one")
        self.assertEqual(len(payload["connector"]["functions"]), 4)

    def test_an_unknown_connector_is_a_lookup_error(self):
        with self.assertRaises(LookupError):
            connector_payload(collected(), "nope", "site-one", NOW)


class FreshTests(unittest.TestCase):
    def test_a_recent_snapshot_is_fresh(self):
        self.assertTrue(fresh({"checked_at": datetime(2026, 11, 18, 11, 56, 0)}, NOW, 300))

    def test_an_old_or_missing_one_is_not(self):
        self.assertFalse(fresh({"checked_at": datetime(2026, 11, 18, 11, 50, 0)}, NOW, 300))
        self.assertFalse(fresh(None, NOW, 300))
        self.assertFalse(fresh({}, NOW, 300))

    def test_the_boundary_is_inclusive(self):
        self.assertTrue(fresh({"checked_at": datetime(2026, 11, 18, 11, 55, 0)}, NOW, 300))


if __name__ == "__main__":
    unittest.main()
