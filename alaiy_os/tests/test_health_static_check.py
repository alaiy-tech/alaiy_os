# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""The static check a connector runs against its own health list, with no bench.

It reads connector_meta.py and the doctype JSON files in the same repo, and reports every way the
list would fail on a real site: a log or settings doctype that is not there, a field that does not
exist, an interval option the engine cannot read.
"""

import json
import tempfile
import unittest
from pathlib import Path

from alaiy_os.health.static_check import check_connector

LOG = {"name": "Thing Sync Log", "fields": [
    {"fieldname": "sync_type", "fieldtype": "Select"}, {"fieldname": "status", "fieldtype": "Select"},
    {"fieldname": "started_at", "fieldtype": "Datetime"}, {"fieldname": "finished_at", "fieldtype": "Datetime"},
    {"fieldname": "items_processed", "fieldtype": "Int"}, {"fieldname": "items_failed", "fieldtype": "Int"},
    {"fieldname": "error_message", "fieldtype": "Small Text"}]}
SETTINGS = {"name": "Thing Settings", "fields": [
    {"fieldname": "stock_interval", "fieldtype": "Select", "options": "Disabled\n5 min\n1 hour\n1 day"},
    {"fieldname": "bad_interval", "fieldtype": "Select", "options": "Disabled\n30\n1 hour"},
    {"fieldname": "minutes", "fieldtype": "Int"},
    {"fieldname": "sync_stock", "fieldtype": "Check"}, {"fieldname": "note", "fieldtype": "Data"}]}
GOOD = {"key": "stock", "label": "Stock", "log_doctype": "Thing Sync Log", "log_filter": {"sync_type": "stock"},
        "interval_setting": "stock_interval",
        "fields": {"processed": "items_processed", "failed": "items_failed", "error": "error_message"}}


def build(root, health, settings_doctype="Thing Settings", doctypes=(LOG, SETTINGS)):
    package = Path(root) / "thing_connector"
    (package / "doctype").mkdir(parents=True)
    for doc in doctypes:
        folder = package / "doctype" / doc["name"].lower().replace(" ", "_")
        folder.mkdir()
        (folder / f"{folder.name}.json").write_text(json.dumps(doc), encoding="utf-8")
    meta = package / "connector_meta.py"
    meta.write_text(f"connector_meta = {{'connector_id': 'thing', 'settings_doctype': {settings_doctype!r}, 'health': {health!r}}}\n",
                    encoding="utf-8")
    return meta


class StaticCheckTests(unittest.TestCase):
    def check(self, health, **kw):
        with tempfile.TemporaryDirectory() as root:
            return check_connector(build(root, health, **kw))

    def test_a_correct_list_has_no_errors(self):
        self.assertEqual(self.check([GOOD]), [])

    def test_a_connector_with_no_list_has_no_errors(self):
        self.assertEqual(self.check([]), [])

    def test_a_malformed_list_is_reported(self):
        self.assertTrue(any("log_doctype" in e for e in self.check([{"key": "x", "label": "X"}])))

    def test_a_missing_log_doctype_is_reported(self):
        self.assertTrue(any("Nowhere Log" in e for e in self.check([{**GOOD, "log_doctype": "Nowhere Log"}])))

    def test_frappe_own_logs_are_accepted_without_a_json_in_the_repo(self):
        self.assertEqual(self.check([{**GOOD, "log_doctype": "Error Log", "scheduled": False, "interval_setting": None,
                                      "log_filter": {}, "fields": {"status": "method", "started_at": "creation"}}]), [])

    def test_a_log_filter_on_a_missing_field_is_reported(self):
        self.assertTrue(any("kind" in e for e in self.check([{**GOOD, "log_filter": {"kind": "stock"}}])))

    def test_a_mapped_field_that_does_not_exist_is_reported(self):
        self.assertTrue(any("nope" in e for e in self.check([{**GOOD, "fields": {"processed": "nope"}}])))

    def test_a_log_without_a_status_field_is_reported(self):
        bare = {"name": "Thing Sync Log", "fields": [{"fieldname": "sync_type", "fieldtype": "Select"}]}
        self.assertTrue(any("status" in e for e in self.check([GOOD], doctypes=(bare, SETTINGS))))

    def test_a_missing_interval_setting_is_reported(self):
        self.assertTrue(any("nothing_here" in e for e in self.check([{**GOOD, "interval_setting": "nothing_here"}])))

    def test_an_interval_option_the_engine_cannot_read_is_reported(self):
        errors = self.check([{**GOOD, "interval_setting": "bad_interval"}])
        self.assertTrue(any("'30'" in e for e in errors), errors)

    def test_an_enabled_setting_must_be_a_check_field_that_exists(self):
        self.assertEqual(self.check([{**GOOD, "enabled_setting": "sync_stock"}]), [])
        self.assertTrue(any("missing_switch" in e for e in self.check([{**GOOD, "enabled_setting": "missing_switch"}])))
        self.assertTrue(any("Check" in e for e in self.check([{**GOOD, "enabled_setting": "note"}])))

    def test_bare_numbers_are_fine_when_the_unit_is_declared(self):
        self.assertEqual(self.check([{**GOOD, "interval_setting": "bad_interval", "interval_unit": "min"}]), [])

    def test_a_numeric_interval_field_is_reported(self):
        self.assertTrue(any("Select" in e for e in self.check([{**GOOD, "interval_setting": "minutes"}])))

    def test_an_unregistered_settings_doctype_is_reported_when_an_interval_is_used(self):
        self.assertTrue(any("settings" in e.lower() for e in self.check([GOOD], settings_doctype="Gone Settings")))


if __name__ == "__main__":
    unittest.main()
