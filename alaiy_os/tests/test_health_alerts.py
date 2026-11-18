# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Slack messages for health changes: what they say, what they must never say, how failure is handled.

No network: the poster is a stand-in that records what it was given.
"""

import unittest
from datetime import datetime

from alaiy_os.health.alerts import BATCH_OVER, change_message, digest_message, notify

NOW = datetime(2026, 11, 18, 12, 0, 0)
HOOK = "https://hooks.example.com/services/T000/B000/hunter2hunter2hunter2hunter2"


def collected(state="failing", error="401 Unauthorized", reason="The last 3 runs failed"):
    return {
        "checked_at": NOW,
        "platform": [{"key": "disk", "label": "Disk space", "state": "red", "detail": "9% free"}],
        "connectors": [{
            "connector_id": "alpha", "connector_name": "Alpha", "state": state, "has_contract": True,
            "functions": [{"key": "stock", "label": "Stock sync", "state": state, "reason": reason,
                           "last_error": error, "last_success_at": datetime(2026, 11, 17, 9, 0)}],
        }],
    }


def change(kind="alert", key="alpha::stock", old="healthy", new="failing"):
    return {"key": key, "old": old, "new": new, "kind": kind, "at": NOW}


class ChangeMessageTests(unittest.TestCase):
    def test_an_alert_names_instance_connector_function_state_reason_and_error(self):
        text = change_message(change(), "site-one", collected())
        for part in ("site-one", "Alpha", "Stock sync", "Failing", "The last 3 runs failed", "401 Unauthorized"):
            self.assertIn(part, text)

    def test_a_recovery_says_so(self):
        text = change_message(change("recovery", old="failing", new="healthy"), "site-one", collected("healthy", ""))
        self.assertIn("recovered", text.lower())
        self.assertIn("Alpha", text)

    def test_a_recovery_does_not_repeat_the_old_error(self):
        text = change_message(change("recovery", old="failing", new="healthy"), "site-one", collected("healthy", "401 Unauthorized"))
        self.assertNotIn("401", text)

    def test_a_platform_alert_names_the_check(self):
        text = change_message(change(key="platform::disk", old="ok", new="red"), "site-one", collected())
        self.assertIn("Disk space", text)
        self.assertIn("9% free", text)

    def test_secrets_never_reach_the_message(self):
        data = collected(error="rejected token=abc123secret", reason="Bearer abcdef.ghijkl.mnopqr failed")
        text = change_message(change(), "site-one", data)
        self.assertNotIn("abc123secret", text)
        self.assertNotIn("abcdef.ghijkl", text)

    def test_a_change_for_a_function_that_no_longer_exists_still_produces_a_message(self):
        text = change_message(change(key="gone::thing"), "site-one", collected())
        self.assertIn("gone", text)


class DigestTests(unittest.TestCase):
    def test_nothing_unhealthy_means_no_digest(self):
        data = collected("healthy", "")
        data["platform"] = [{"key": "disk", "label": "Disk space", "state": "ok", "detail": "80% free"}]
        self.assertIsNone(digest_message("site-one", data))

    def test_disabled_and_no_contract_are_not_digest_items(self):
        data = collected("disabled", "")
        data["platform"] = []
        data["connectors"].append({"connector_id": "beta", "connector_name": "Beta", "state": "no_contract",
                                   "has_contract": False, "functions": []})
        self.assertIsNone(digest_message("site-one", data))

    def test_platform_warnings_are_listed_but_unknown_is_not(self):
        data = collected("healthy", "")
        data["platform"] = [{"key": "disk", "label": "Disk space", "state": "warn", "detail": "22% free"},
                            {"key": "x", "label": "Probe X", "state": "unknown", "detail": ""}]
        text = digest_message("site-one", data)
        self.assertIn("Disk space", text)
        self.assertNotIn("Probe X", text)

    def test_unhealthy_items_are_listed(self):
        text = digest_message("site-one", collected("overdue"))
        self.assertIn("Alpha", text)
        self.assertIn("Overdue", text)
        self.assertIn("Disk space", text)


class NotifyTests(unittest.TestCase):
    def test_one_message_per_change(self):
        sent = []
        notify([change(), change(key="platform::disk", old="ok", new="red")], collected(),
               site="site-one", webhook=HOOK, post=lambda url, text: sent.append((url, text)))
        self.assertEqual(len(sent), 2)
        self.assertTrue(all(url == HOOK for url, _ in sent))

    def test_a_burst_of_changes_is_one_summary_not_a_storm(self):
        sent = []
        many = [change(key=f"alpha::f{i}") for i in range(BATCH_OVER + 3)]
        notify(many, collected(), site="site-one", webhook=HOOK, post=lambda url, text: sent.append(text))
        self.assertEqual(len(sent), 1)
        self.assertIn(str(len(many)), sent[0])

    def test_the_threshold_is_exactly_five_changes(self):
        for count, posts in ((5, 5), (6, 1)):
            sent = []
            changes = [change(key=f"alpha::f{i}") for i in range(count)]
            notify(changes, collected(), site="site-one", webhook=HOOK, post=lambda url, text: sent.append(text))
            self.assertEqual(len(sent), posts, count)

    def test_a_burst_summary_is_scrubbed_too(self):
        sent = []
        data = collected(error="rejected token=abc123secret")
        many = [change(key="alpha::stock")] * (BATCH_OVER + 1)
        notify(many, data, site="site-one", webhook=HOOK, post=lambda url, text: sent.append(text))
        self.assertNotIn("abc123secret", sent[0])

    def test_no_webhook_sends_nothing_and_does_not_fail(self):
        sent = []
        notify([change()], collected(), site="site-one", webhook=None, post=lambda *a: sent.append(a))
        self.assertEqual(sent, [])

    def test_a_failed_post_is_logged_without_the_webhook_and_never_raised(self):
        logged = []

        def broken(url, text):
            raise RuntimeError(f"cannot reach {url}")

        notify([change()], collected(), site="site-one", webhook=HOOK, post=broken, log=logged.append)
        self.assertEqual(len(logged), 1)
        self.assertNotIn("hunter2", logged[0])
        self.assertIn("RuntimeError", logged[0])

    def test_one_failed_post_does_not_stop_the_rest(self):
        calls = []

        def flaky(url, text):
            calls.append(text)
            if len(calls) == 1:
                raise RuntimeError("down")

        notify([change(), change(key="platform::disk", old="ok", new="red")], collected(),
               site="site-one", webhook=HOOK, post=flaky, log=lambda m: None)
        self.assertEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main()
