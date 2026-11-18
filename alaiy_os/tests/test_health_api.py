# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""The health API: who may call it and what it does with the request.

Frappe is a stand-in here; what is pinned is that the page can never run a path it supplies and
that a sync started from the page runs in a worker, not inside the web request.
"""

import importlib
import json
import sys
import types
import unittest
from datetime import datetime, timedelta

NOW = datetime(2026, 11, 18, 12, 0, 0)


def sample(checked_at=NOW):
    return {
        "checked_at": checked_at,
        "platform": [{"key": "disk", "label": "Disk", "state": "ok", "detail": "40% free"}],
        "connectors": [{
            "connector_id": "alpha", "connector_name": "Alpha", "state": "failing", "has_contract": True,
            "operations": [], "can_test": True,
            "functions": [{"key": "stock", "label": "Stock", "state": "failing", "reason": "x", "last_error": "",
                           "last_success_at": NOW - timedelta(hours=2), "lag_minutes": 120, "consecutive_failures": 3}],
        }],
    }


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.enqueued, self.guarded, self.store, self.snapshots = [], [], {}, []
        frappe = types.ModuleType("frappe")
        frappe.whitelist = lambda **kw: (lambda fn: fn)
        frappe.only_for = lambda role: self.guarded.append(role)
        frappe.throw = lambda message: (_ for _ in ()).throw(RuntimeError(message))
        frappe.get_doc = lambda doctype, name: {"sync_items_method": "pkg.sync.items", "sync_items_label": "Items"}
        frappe.enqueue = lambda method, **kw: self.enqueued.append((method, kw))
        utils = types.ModuleType("frappe.utils")
        utils.now_datetime = lambda: NOW
        utils.cint = lambda value: int(value or 0)
        utils.get_system_timezone = lambda: "Asia/Kolkata"
        frappe.local = types.SimpleNamespace(site="site-one")
        frappe.cache = types.SimpleNamespace(
            get_value=lambda key, **kw: self.store.get(key),
            set_value=lambda key, value, expires_in_sec=None, **kw: self.store.__setitem__(key, value))
        connectors = types.ModuleType("alaiy_os.connectors")
        connectors.sync_operations = lambda row: {"items": row["sync_items_method"]}
        connectors.call_dotted = lambda path, **kw: (_ for _ in ()).throw(AssertionError("must not run inline"))
        self.saved = {k: sys.modules.get(k) for k in ("frappe", "frappe.utils", "alaiy_os.connectors", "alaiy_os.api.health")}
        sys.modules.update({"frappe": frappe, "frappe.utils": utils, "alaiy_os.connectors": connectors})
        sys.modules.pop("alaiy_os.api.health", None)
        self.api = importlib.import_module("alaiy_os.api.health")
        from alaiy_os.health import service
        self.service, self.real_snapshot = service, service.snapshot
        service.snapshot = lambda now, **kw: self.snapshots.append(now) or sample()

    def tearDown(self):
        self.service.snapshot = self.real_snapshot
        for key, value in self.saved.items():
            if value is None:
                sys.modules.pop(key, None)
            else:
                sys.modules[key] = value

    def test_run_sync_is_system_manager_only_and_runs_in_a_worker(self):
        result = self.api.run_sync("alpha", "Items")
        self.assertEqual(self.guarded, ["System Manager"])
        self.assertEqual(self.enqueued[0][0], "alaiy_os.connectors.call_dotted")
        self.assertEqual(self.enqueued[0][1]["method_path"], "pkg.sync.items")
        self.assertTrue(result["queued"])

    def test_an_operation_the_connector_did_not_declare_is_refused(self):
        for requested in ("orders", "pkg.sync.items", ""):
            with self.assertRaises(RuntimeError, msg=requested):
                self.api.run_sync("alpha", requested)
        self.assertEqual(self.enqueued, [])

    # ── read endpoints for dashboards ─────────────────────────────────────────────────────────

    def test_the_read_endpoints_allow_system_manager_and_os_manager(self):
        for call in (self.api.get_summary, self.api.get_report, lambda: self.api.get_connector("alpha")):
            self.guarded.clear()
            call()
            self.assertEqual(set(self.guarded[0]), {"System Manager", "OS Manager"})

    def test_running_a_sync_stays_system_manager_only(self):
        self.api.run_sync("alpha", "Items")
        self.assertEqual(self.guarded, ["System Manager"])

    def test_the_summary_is_plain_json_with_iso_times_and_the_instance(self):
        summary = self.api.get_summary()
        json.dumps(summary)
        self.assertEqual((summary["schema"], summary["instance"], summary["overall"]), (1, "site-one", "critical"))
        self.assertEqual(summary["generated_at"], "2026-11-18T12:00:00+05:30")
        self.assertEqual(summary["problems"][0]["last_success_at"], "2026-11-18T10:00:00+05:30")

    def test_the_report_carries_every_function(self):
        report = self.api.get_report()
        json.dumps(report)
        self.assertEqual(report["connectors"][0]["functions"][0]["key"], "stock")

    def test_one_connector_by_id_and_an_unknown_one_is_refused(self):
        self.assertEqual(self.api.get_connector("alpha")["connector"]["connector_id"], "alpha")
        with self.assertRaises(RuntimeError):
            self.api.get_connector("nope")

    def test_a_fresh_stored_snapshot_is_served_without_recomputing(self):
        self.api.get_summary()
        self.api.get_summary()
        self.api.get_report()
        self.assertEqual(len(self.snapshots), 1)

    def test_live_forces_a_recompute(self):
        self.api.get_summary()
        self.api.get_summary(live=1)
        self.assertEqual(len(self.snapshots), 2)

    def test_a_stale_snapshot_is_recomputed(self):
        self.store[self.service.CACHE_KEY] = sample(NOW - timedelta(minutes=30))
        self.api.get_summary()
        self.assertEqual(len(self.snapshots), 1)


if __name__ == "__main__":
    unittest.main()
