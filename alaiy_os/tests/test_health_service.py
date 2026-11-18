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

from alaiy_os.health.service import collect, flatten

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


if __name__ == "__main__":
    unittest.main()
