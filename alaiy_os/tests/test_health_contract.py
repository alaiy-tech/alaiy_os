# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""The health list a connector declares in its registry row: what is accepted and what is refused.

A malformed list must fail at registration time with a message that names the entry and the key,
not later as a page that shows nothing.
"""

import json
import unittest

from alaiy_os.health.contract import health_for_storage, normalise_health

GOOD = {
    "key": "stock", "label": "Stock sync", "log_doctype": "Some Sync Log",
    "log_filter": {"sync_type": "stock"}, "interval_setting": "stock_interval",
}


class NormaliseHealthTests(unittest.TestCase):
    def test_nothing_declared_is_an_empty_list(self):
        for value in (None, "", [], "[]"):
            self.assertEqual(normalise_health(value), [], repr(value))

    def test_defaults_are_filled(self):
        entry = normalise_health([GOOD])[0]
        self.assertEqual(entry["direction"], "pull")
        self.assertTrue(entry["scheduled"])
        self.assertTrue(entry["expects_rows"])
        self.assertEqual(entry["fields"], {})

    def test_a_list_and_its_json_string_agree(self):
        self.assertEqual(normalise_health([GOOD]), normalise_health(json.dumps([GOOD])))

    def test_missing_required_key_names_the_entry_and_the_key(self):
        for missing in ("key", "label", "log_doctype"):
            entry = {k: v for k, v in GOOD.items() if k != missing}
            with self.assertRaises(ValueError) as caught:
                normalise_health([GOOD, entry])
            self.assertIn("entry 1", str(caught.exception))
            self.assertIn(missing, str(caught.exception))

    def test_an_empty_required_value_is_refused(self):
        with self.assertRaises(ValueError):
            normalise_health([{**GOOD, "key": ""}])

    def test_unknown_key_is_refused(self):
        with self.assertRaises(ValueError) as caught:
            normalise_health([{**GOOD, "lable": "typo"}])
        self.assertIn("lable", str(caught.exception))

    def test_duplicate_key_is_refused(self):
        with self.assertRaises(ValueError) as caught:
            normalise_health([GOOD, {**GOOD, "label": "Again"}])
        self.assertIn("stock", str(caught.exception))

    def test_direction_must_be_pull_or_push(self):
        with self.assertRaises(ValueError):
            normalise_health([{**GOOD, "direction": "sideways"}])
        self.assertEqual(normalise_health([{**GOOD, "direction": "push"}])[0]["direction"], "push")

    def test_field_map_may_only_name_standard_fields(self):
        with self.assertRaises(ValueError):
            normalise_health([{**GOOD, "fields": {"colour": "x"}}])
        ok = normalise_health([{**GOOD, "fields": {"processed": "items_processed", "changed": ["a", "b"]}}])
        self.assertEqual(ok[0]["fields"]["changed"], ["a", "b"])

    def test_a_scheduled_function_needs_an_interval_setting(self):
        entry = {k: v for k, v in GOOD.items() if k != "interval_setting"}
        with self.assertRaises(ValueError):
            normalise_health([entry])
        self.assertFalse(normalise_health([{**entry, "scheduled": False}])[0]["scheduled"])

    def test_garbage_is_refused_not_ignored(self):
        for value in ("{not json", '{"key": "x"}', 5, ["text"]):
            with self.assertRaises(ValueError, msg=repr(value)):
                normalise_health(value)


class StorageTests(unittest.TestCase):
    def test_empty_is_stored_as_an_empty_string(self):
        for value in (None, "", [], "[]"):
            self.assertEqual(health_for_storage(value), "", repr(value))

    def test_a_valid_list_round_trips_through_json(self):
        stored = health_for_storage([GOOD])
        self.assertEqual(json.loads(stored), normalise_health([GOOD]))
        self.assertEqual(health_for_storage(stored), stored)

    def test_an_invalid_list_is_refused(self):
        with self.assertRaises(ValueError):
            health_for_storage([{"key": "x"}])


if __name__ == "__main__":
    unittest.main()
