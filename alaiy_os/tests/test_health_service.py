# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Collecting health for every registered connector.

The registry, settings and log readers are injected, so this runs without a bench. What is pinned
here is isolation (one broken connector never hides the others) and the failure modes that must
never read as healthy: no contract, unreadable settings, a log that cannot be read.
"""

import json
import unittest
from datetime import datetime, timedelta

from alaiy_os.health.service import collect, flatten, flags_for, pick_operation, settings_value

NOW = datetime(2026, 11, 18, 12, 0, 0)


def run(minutes_ago, status="success", processed=10, error=""):
    start = NOW - timedelta(minutes=minutes_ago)
    return {"status": status, "started_at": start, "finished_at": start, "processed": processed,
            "changed": processed, "failed": 0, "skipped": 0, "error": error}


def entry(key="stock", **extra):
    return {"key": key, "label": key.title(), "log_doctype": "Some Log", "interval_setting": f"{key}_interval", **extra}


def row(connector_id="alpha", health=None, enabled=1):
    return {"connector_id": connector_id, "connector_name": connector_id.title(), "is_enabled": enabled,
            "health": json.dumps(health) if health is not None else None}


def collect_with(rows, runs=None, interval="30 min"):
    def runs_reader(e):
        value = runs(e) if callable(runs) else (runs if runs is not None else [run(5)])
        if isinstance(value, Exception):
            raise value
        return value

    def interval_reader(r, e):
        if isinstance(interval, Exception):
            raise interval
        return interval

    return collect(NOW, rows=rows, runs_reader=runs_reader, interval_reader=interval_reader)


def functions(result, connector_id):
    return next(c for c in result["connectors"] if c["connector_id"] == connector_id)["functions"]


class CollectTests(unittest.TestCase):
    def test_a_healthy_connector(self):
        result = collect_with([row(health=[entry()])])
        connector = result["connectors"][0]
        self.assertEqual((connector["state"], connector["has_contract"]), ("healthy", True))
        self.assertEqual(functions(result, "alpha")[0]["state"], "healthy")

    def test_a_connector_without_a_contract_is_never_healthy(self):
        for health in (None, []):
            connector = collect_with([row(health=health)])["connectors"][0]
            self.assertEqual((connector["state"], connector["has_contract"]), ("no_contract", False))

    def test_the_page_gets_the_actions_a_connector_offers(self):
        full = {**row(health=[entry()]), "sync_items_method": "pkg.items", "sync_items_label": "Items",
                "sync_categories_method": "pkg.cats", "sync_categories_label": "", "test_method": "pkg.test"}
        connector = collect_with([full])["connectors"][0]
        self.assertEqual(connector["operations"], ["categories", "Items"])
        self.assertTrue(connector["can_test"])
        bare = collect_with([row(health=[entry()])])["connectors"][0]
        self.assertEqual((bare["operations"], bare["can_test"]), ([], False))

    def test_each_function_names_its_log_for_the_page_link(self):
        function = functions(collect_with([row(health=[entry(log_filter={"sync_type": "stock"})])]), "alpha")[0]
        self.assertEqual((function["log_doctype"], function["log_filter"]), ("Some Log", {"sync_type": "stock"}))

    def test_the_connector_state_is_its_worst_function(self):
        result = collect_with([row(health=[entry("a"), entry("b")])],
                              runs=lambda e: [run(5)] if e["key"] == "a" else [run(500)])
        self.assertEqual(result["connectors"][0]["state"], "overdue")

    def test_a_malformed_health_list_does_not_hide_other_connectors(self):
        bad = {"connector_id": "broken", "connector_name": "Broken", "is_enabled": 1, "health": "{nope"}
        result = collect_with([bad, row("good", [entry()])])
        self.assertEqual(functions(result, "broken")[0]["state"], "config_invalid")
        self.assertEqual(functions(result, "good")[0]["state"], "healthy")

    def test_an_unreadable_log_affects_only_that_function(self):
        result = collect_with([row(health=[entry("a"), entry("b")])],
                              runs=lambda e: RuntimeError("table gone") if e["key"] == "a" else [run(5)])
        by_key = {f["key"]: f for f in functions(result, "alpha")}
        self.assertEqual(by_key["a"]["state"], "config_invalid")
        self.assertNotIn("table gone", by_key["a"]["reason"])
        self.assertEqual(by_key["b"]["state"], "healthy")

    def test_unreadable_settings_read_as_an_invalid_interval_not_disabled(self):
        result = collect_with([row(health=[entry()])], interval=RuntimeError("no settings"))
        self.assertEqual(functions(result, "alpha")[0]["state"], "config_invalid")

    def test_an_on_demand_function_never_reads_settings(self):
        calls = []
        result = collect(NOW, rows=[row(health=[entry(scheduled=False, interval_setting=None)])],
                         runs_reader=lambda e: [run(5)], interval_reader=lambda r, e: calls.append(e))
        self.assertEqual(calls, [])
        self.assertEqual(functions(result, "alpha")[0]["state"], "healthy")

    def test_a_function_with_its_own_switch_off_is_disabled(self):
        result = collect(NOW, rows=[row(health=[entry(enabled_setting="sync_stock")])], runs_reader=lambda e: [run(500)],
                         interval_reader=lambda r, e: "30 min", switch_reader=lambda r, e: 0)
        self.assertEqual(functions(result, "alpha")[0]["state"], "disabled")

    def test_an_unreadable_switch_is_a_configuration_problem_not_disabled(self):
        def broken(r, e):
            raise RuntimeError("no settings")
        result = collect(NOW, rows=[row(health=[entry(enabled_setting="sync_stock")])], runs_reader=lambda e: [run(5)],
                         interval_reader=lambda r, e: "30 min", switch_reader=broken)
        self.assertEqual(functions(result, "alpha")[0]["state"], "config_invalid")

    def test_a_function_without_a_switch_never_reads_one(self):
        calls = []
        collect(NOW, rows=[row(health=[entry()])], runs_reader=lambda e: [run(5)],
                interval_reader=lambda r, e: "30 min", switch_reader=lambda r, e: calls.append(e))
        self.assertEqual(calls, [])

    def test_a_disabled_connector_is_disabled(self):
        result = collect_with([row(health=[entry()], enabled=0)])
        self.assertEqual(functions(result, "alpha")[0]["state"], "disabled")

    def test_errors_are_scrubbed(self):
        runs = [run(5, status="failed", processed=0, error="rejected token=abc123secret")] * 3
        result = collect_with([row(health=[entry()])], runs=runs)
        self.assertNotIn("abc123secret", functions(result, "alpha")[0]["last_error"])


class FlattenTests(unittest.TestCase):
    def test_keys_join_connector_and_function_and_include_platform(self):
        collected = collect_with([row(health=[entry()])])
        collected["platform"] = [{"key": "disk", "label": "Disk", "state": "red", "detail": "9% free"}]
        flat = flatten(collected)
        self.assertEqual(flat["alpha::stock"]["state"], "healthy")
        self.assertEqual(flat["platform::disk"]["state"], "red")


def request_entry(**extra):
    return {"key": "calls", "label": "API calls", "kind": "requests", "log_doctype": "Some Request Log", **extra}


def req_rows(n, failed=0):
    return [{"status": "failed" if i < failed else "success", "at": NOW - timedelta(minutes=i), "duration_ms": 100, "error": ""}
            for i in range(n)]


class RequestKindTests(unittest.TestCase):
    def run_one(self, rows, **kw):
        def requests_reader(entry, now):
            return rows, NOW - timedelta(minutes=1), "boom"

        def never(*a):
            raise AssertionError("a request log has no interval and no switch to read")

        return collect(NOW, rows=[row(health=[request_entry(**kw)])], runs_reader=never, interval_reader=never,
                       switch_reader=never, requests_reader=requests_reader)["connectors"][0]

    def test_a_request_log_is_judged_on_its_window_and_reads_no_interval(self):
        connector = self.run_one(req_rows(10))
        self.assertEqual((connector["state"], connector["functions"][0]["kind"]), ("healthy", "requests"))

    def test_failing_calls_make_it_failing_with_the_last_error(self):
        function = self.run_one(req_rows(10, failed=6))["functions"][0]
        self.assertEqual((function["state"], function["last_error"]), ("failing", "boom"))

    def test_it_names_the_log_for_the_page_link(self):
        function = self.run_one(req_rows(10), log_filter={"context": "search"})["functions"][0]
        self.assertEqual((function["log_doctype"], function["log_filter"]), ("Some Request Log", {"context": "search"}))

    def test_an_unreadable_request_log_is_a_configuration_problem(self):
        def broken(entry, now):
            raise RuntimeError("table gone")
        result = collect(NOW, rows=[row(health=[request_entry()])], requests_reader=broken)
        self.assertEqual(result["connectors"][0]["functions"][0]["state"], "config_invalid")


def check(key="fresh", state="ok", detail=""):
    return {"key": key, "label": key.title(), "state": state, "detail": detail}


class CustomCheckTests(unittest.TestCase):
    def collect(self, checks_reader, health=None, method="pkg.check", enabled=1):
        r = {**row(health=health if health is not None else [entry()], enabled=enabled), "health_method": method}
        return collect(NOW, rows=[r], runs_reader=lambda e: [run(5)], interval_reader=lambda r_, e: "30 min",
                       checks_reader=checks_reader)["connectors"][0]

    def test_the_connectors_checks_are_returned_with_it(self):
        connector = self.collect(lambda r: [check(state="warn", detail="2 of 10 differ")])
        self.assertEqual(connector["checks"], [check(state="warn", detail="2 of 10 differ")])

    def test_a_red_check_makes_the_connector_failing_and_a_warn_check_a_warning(self):
        self.assertEqual(self.collect(lambda r: [check(state="red")])["state"], "failing")
        self.assertEqual(self.collect(lambda r: [check(state="warn")])["state"], "warning")
        self.assertEqual(self.collect(lambda r: [check(state="ok")])["state"], "healthy")

    def test_a_connector_with_only_a_check_has_a_contract(self):
        connector = self.collect(lambda r: [check(state="ok")], health=[])
        self.assertEqual((connector["has_contract"], connector["state"], connector["functions"]), (True, "healthy", []))

    def test_a_connector_without_a_method_never_calls_the_reader(self):
        calls = []
        r = row(health=[entry()])
        result = collect(NOW, rows=[r], runs_reader=lambda e: [run(5)], interval_reader=lambda r_, e: "30 min",
                         checks_reader=lambda r_: calls.append(r_))
        self.assertEqual((calls, result["connectors"][0]["checks"]), ([], []))

    def test_a_check_that_raises_becomes_a_red_check_and_hides_nothing_else(self):
        def broken(r):
            raise RuntimeError("down https://x.example.com/?token=abc123secret")
        connector = self.collect(broken)
        self.assertEqual(connector["checks"][0]["state"], "red")
        self.assertNotIn("abc123secret", connector["checks"][0]["detail"])
        self.assertEqual(connector["functions"][0]["state"], "healthy")

    def test_a_malformed_result_becomes_a_red_check(self):
        self.assertEqual(self.collect(lambda r: "nonsense")["checks"][0]["state"], "red")

    def test_a_disabled_connector_does_not_run_its_check(self):
        calls = []
        connector = self.collect(lambda r: calls.append(r) or [check()], enabled=0)
        self.assertEqual((calls, connector["checks"]), ([], []))

    def test_checks_are_flattened_for_change_detection(self):
        connector = self.collect(lambda r: [check(state="red")])
        flat = flatten({"platform": [], "connectors": [connector]})
        self.assertEqual(flat["check::alpha::fresh"]["state"], "red")


class _Doc(dict):
    """A stand-in for a settings document."""

    def __init__(self, values, new=False, modified="2026-11-01 10:00:00"):
        super().__init__({**values, "modified": modified})
        self._new = new

    def is_new(self):
        return self._new


class SettingsValueTests(unittest.TestCase):
    def test_a_saved_value_is_returned(self):
        self.assertEqual(settings_value(_Doc({"interval": "30 min"}), "interval"), "30 min")
        self.assertEqual(settings_value(_Doc({"interval": "Disabled"}), "interval"), "Disabled")

    def test_a_settings_record_that_was_never_saved_is_unreadable_not_disabled(self):
        # An unsaved record carries field defaults, which would read as "disabled".
        for doc in (_Doc({"interval": ""}, new=True), _Doc({"interval": ""}, modified=None)):
            with self.assertRaises(LookupError):
                settings_value(doc, "interval")


class FlagsTests(unittest.TestCase):
    def test_an_alert_marks_the_key_announced_and_a_recovery_clears_it(self):
        previous = {"a::x": {"state": "healthy", "alerted": False, "alerted_at": None}}
        sent = flags_for([{"key": "a::x", "kind": "alert"}], previous, NOW)
        self.assertEqual(sent["a::x"], {"alerted": True, "alerted_at": NOW})
        later = flags_for([{"key": "a::x", "kind": "recovery"}], {"a::x": sent["a::x"]}, NOW)
        self.assertEqual(later["a::x"], {"alerted": False, "alerted_at": NOW})

    def test_an_unchanged_key_keeps_its_flags(self):
        previous = {"a::x": {"state": "failing", "alerted": True, "alerted_at": NOW}}
        self.assertEqual(flags_for([], previous, NOW)["a::x"], {"alerted": True, "alerted_at": NOW})


class PickOperationTests(unittest.TestCase):
    OPS = {"items": "pkg.sync.items", "category tree": "pkg.sync.categories"}

    def test_a_declared_operation_resolves_case_insensitively(self):
        self.assertEqual(pick_operation(self.OPS, "Items"), "pkg.sync.items")
        self.assertEqual(pick_operation(self.OPS, " Category Tree "), "pkg.sync.categories")

    def test_anything_else_is_refused_including_a_dotted_path(self):
        for requested in ("orders", "", None, "pkg.sync.items", "os.system"):
            with self.assertRaises(ValueError, msg=repr(requested)):
                pick_operation(self.OPS, requested)


if __name__ == "__main__":
    unittest.main()
