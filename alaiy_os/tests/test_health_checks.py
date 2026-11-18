# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""A connector's own health check (`health_method`): what it may return and what a bad one becomes.

A custom check runs connector code, so whatever it returns or raises must never break the page or leak a secret.
"""

import unittest

from alaiy_os.health.checks import connector_state_for, failed_check, normalise_checks

GOOD = {"key": "fresh", "label": "Stock matches", "state": "warn", "detail": "2 of 10 sampled items differ"}


class NormaliseTests(unittest.TestCase):
    def test_a_list_of_checks_is_accepted(self):
        self.assertEqual(normalise_checks([GOOD]), [GOOD])

    def test_a_single_check_is_accepted(self):
        self.assertEqual(normalise_checks(GOOD), [GOOD])

    def test_nothing_returned_is_no_checks(self):
        for value in (None, [], ()):
            self.assertEqual(normalise_checks(value), [], repr(value))

    def test_detail_is_optional_and_scrubbed(self):
        out = normalise_checks([{"key": "k", "label": "L", "state": "ok"}, {**GOOD, "detail": "rejected token=abc123secret"}])
        self.assertEqual(out[0]["detail"], "")
        self.assertNotIn("abc123secret", out[1]["detail"])

    def test_a_malformed_result_becomes_one_red_check(self):
        for bad in ("fine", 5, [{"key": "k"}], [{"key": "k", "label": "L", "state": "great"}], [GOOD, "x"], {"key": "k"}):
            out = normalise_checks(bad)
            self.assertEqual(len(out), 1, repr(bad))
            self.assertEqual((out[0]["key"], out[0]["state"]), ("health_method", "red"))

    def test_a_check_that_raised_names_only_the_exception_class(self):
        out = failed_check(RuntimeError("cannot reach https://x.example.com/?token=abc123secret"))
        self.assertEqual((out["state"], out["key"]), ("red", "health_method"))
        self.assertIn("RuntimeError", out["detail"])
        self.assertNotIn("abc123secret", out["detail"])


class ConnectorStateTests(unittest.TestCase):
    def test_red_is_failing_warn_is_warning_the_rest_do_not_count(self):
        self.assertEqual(connector_state_for([{"state": "red"}]), "failing")
        self.assertEqual(connector_state_for([{"state": "warn"}, {"state": "ok"}]), "warning")
        self.assertEqual(connector_state_for([{"state": "red"}, {"state": "warn"}]), "failing")
        self.assertIsNone(connector_state_for([{"state": "ok"}, {"state": "unknown"}]))
        self.assertIsNone(connector_state_for([]))


if __name__ == "__main__":
    unittest.main()
