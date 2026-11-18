# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""The health API: who may call it and what it does with the request.

Frappe is a stand-in here; what is pinned is that the page can never run a path it supplies and
that a sync started from the page runs in a worker, not inside the web request.
"""

import importlib
import sys
import types
import unittest


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.enqueued, self.guarded = [], []
        frappe = types.ModuleType("frappe")
        frappe.whitelist = lambda **kw: (lambda fn: fn)
        frappe.only_for = lambda role: self.guarded.append(role)
        frappe.throw = lambda message: (_ for _ in ()).throw(RuntimeError(message))
        frappe.get_doc = lambda doctype, name: {"sync_items_method": "pkg.sync.items", "sync_items_label": "Items"}
        frappe.enqueue = lambda method, **kw: self.enqueued.append((method, kw))
        utils = types.ModuleType("frappe.utils")
        utils.now_datetime = lambda: None
        connectors = types.ModuleType("alaiy_os.connectors")
        connectors.sync_operations = lambda row: {"items": row["sync_items_method"]}
        connectors.call_dotted = lambda path, **kw: (_ for _ in ()).throw(AssertionError("must not run inline"))
        self.saved = {k: sys.modules.get(k) for k in ("frappe", "frappe.utils", "alaiy_os.connectors", "alaiy_os.api.health")}
        sys.modules.update({"frappe": frappe, "frappe.utils": utils, "alaiy_os.connectors": connectors})
        sys.modules.pop("alaiy_os.api.health", None)
        self.api = importlib.import_module("alaiy_os.api.health")

    def tearDown(self):
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


if __name__ == "__main__":
    unittest.main()
