# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Reading a connector's own log into run records, and finishing a run honestly.

`finish_run` exists so a run cannot end "success" when every item failed or every row was skipped.
`read_runs` is checked against a stand-in for Frappe: the query must be bounded and must only ask
for fields the log actually has.
"""

import sys
import types
import unittest
from datetime import datetime, timedelta

from alaiy_os.health.runs import finish_run, normalise_run, read_runs, run_status

T0 = datetime(2026, 11, 18, 10, 0, 0)


class RunStatusTests(unittest.TestCase):
    def test_plain_success(self):
        self.assertEqual(run_status(100, 0, 0), "success")
        self.assertEqual(run_status(0, 0, 0), "success")  # nothing to do is not a failure

    def test_every_item_failed_is_failed_never_success(self):
        self.assertEqual(run_status(1319, 1319, 0), "failed")
        self.assertEqual(run_status(3, 3, 0), "failed")

    def test_some_failures_still_succeed(self):
        self.assertEqual(run_status(100, 5, 0), "success")

    def test_everything_skipped_is_skipped(self):
        self.assertEqual(run_status(0, 0, 40), "skipped")

    def test_an_error_with_nothing_processed_is_failed(self):
        self.assertEqual(run_status(0, 0, 0, error="401 Unauthorized"), "failed")

    def test_partly_skipped_is_success(self):
        self.assertEqual(run_status(10, 0, 4), "success")


class NormaliseRunTests(unittest.TestCase):
    def row(self, **extra):
        base = {"status": "Success", "started_at": T0, "finished_at": T0 + timedelta(minutes=2),
                "processed": 5, "changed": 3, "failed": 1, "skipped": 0, "error": None}
        return {**base, **extra}

    def test_standard_names_need_no_map(self):
        run = normalise_run(self.row())
        self.assertEqual((run["status"], run["processed"], run["changed"], run["failed"]), ("success", 5, 3, 1))

    def test_field_map_renames_and_sums_lists(self):
        row = {"state": "completed", "begun": T0, "ended": T0, "items_processed": 9,
               "items_created": 2, "items_updated": 3, "items_failed": None, "msg": "boom"}
        fields = {"status": "state", "started_at": "begun", "finished_at": "ended", "processed": "items_processed",
                  "changed": ["items_created", "items_updated"], "failed": "items_failed", "error": "msg"}
        run = normalise_run(row, fields)
        self.assertEqual((run["status"], run["changed"], run["failed"], run["error"]), ("success", 5, 0, "boom"))

    def test_status_aliases_and_override(self):
        self.assertEqual(normalise_run(self.row(status="Error"))["status"], "failed")
        self.assertEqual(normalise_run(self.row(status="Partial"), status_map={"partial": "failed"})["status"], "failed")

    def test_unknown_status_is_kept_as_is(self):
        self.assertEqual(normalise_run(self.row(status="Weird"))["status"], "weird")

    def test_null_counts_become_zero(self):
        run = normalise_run(self.row(processed=None, changed=None, failed=None, skipped=None))
        self.assertEqual((run["processed"], run["changed"], run["failed"], run["skipped"]), (0, 0, 0, 0))

    def test_a_finish_time_before_the_start_is_dropped(self):
        run = normalise_run(self.row(finished_at=T0 - timedelta(minutes=5)))
        self.assertIsNone(run["finished_at"])


class _Meta:
    def __init__(self, fields):
        self.fields = fields

    def has_field(self, name):
        return name in self.fields


class _Log:
    def __init__(self, fields):
        self.meta = _Meta(fields)
        self.status = "running"


class FinishRunTests(unittest.TestCase):
    def test_success_sets_counts_and_finish_time(self):
        log = _Log({"status", "finished_at", "processed", "failed", "skipped", "error"})
        finish_run(log, processed=10, failed=1, skipped=2, now=T0)
        self.assertEqual((log.status, log.processed, log.failed, log.skipped, log.finished_at), ("success", 10, 1, 2, T0))

    def test_all_failed_never_ends_success(self):
        log = _Log({"status", "finished_at", "processed", "failed"})
        finish_run(log, processed=4, failed=4, now=T0)
        self.assertEqual(log.status, "failed")

    def test_a_log_without_a_skipped_field_is_not_written_one(self):
        log = _Log({"status", "finished_at", "processed", "failed"})
        finish_run(log, processed=4, failed=0, skipped=2, now=T0)
        self.assertFalse(hasattr(log, "skipped"))

    def test_field_map_and_scrubbed_error(self):
        log = _Log({"status", "finished_at", "items_processed", "items_failed", "error_message"})
        fields = {"processed": "items_processed", "failed": "items_failed", "error": "error_message"}
        finish_run(log, processed=0, failed=0, error="401\nBearer abc.def.ghi", fields=fields, now=T0)
        self.assertEqual(log.status, "failed")
        self.assertEqual(log.error_message, "401")


class ReadRunsTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        frappe = types.ModuleType("frappe")
        outer = self

        class Meta:
            def has_field(self, name):
                return name in {"sync_type", "status", "started_at", "finished_at", "items_processed", "items_failed"}

        frappe.get_meta = lambda doctype: Meta()
        frappe.get_all = lambda doctype, **kw: outer.calls.append((doctype, kw)) or [
            {"status": "Success", "started_at": T0, "finished_at": T0, "items_processed": 4, "items_failed": 0}]
        self.saved = sys.modules.get("frappe")
        sys.modules["frappe"] = frappe

    def tearDown(self):
        if self.saved is None:
            sys.modules.pop("frappe", None)
        else:
            sys.modules["frappe"] = self.saved

    def entry(self):
        return {"log_doctype": "Some Sync Log", "log_filter": {"sync_type": "stock"},
                "fields": {"processed": "items_processed", "failed": "items_failed", "skipped": "items_skipped"}}

    def test_the_query_is_bounded_ordered_and_filtered(self):
        read_runs(self.entry(), limit=25)
        doctype, kw = self.calls[0]
        self.assertEqual(doctype, "Some Sync Log")
        self.assertEqual(kw["limit"], 25)
        self.assertEqual(kw["filters"], {"sync_type": "stock"})
        self.assertEqual(kw["order_by"], "started_at desc")

    def test_only_fields_the_log_has_are_requested(self):
        read_runs(self.entry())
        fields = self.calls[0][1]["fields"]
        self.assertIn("items_processed", fields)
        self.assertNotIn("items_skipped", fields)

    def test_rows_come_back_normalised(self):
        runs = read_runs(self.entry())
        self.assertEqual((runs[0]["status"], runs[0]["processed"], runs[0]["skipped"]), ("success", 4, 0))


if __name__ == "__main__":
    unittest.main()
