# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""When does a state change deserve a message? Once per change, and once on recovery.

A function that stays failing must not alert every five minutes; a function that flaps must alert
for each move into a bad state, not for each check.
"""

import unittest
from datetime import datetime

from alaiy_os.health.changes import diff

NOW = datetime(2026, 11, 18, 12, 0, 0)


def kinds(previous, current):
    return {c["key"]: c["kind"] for c in diff(previous, current, NOW)}


BAD = {"overdue", "stuck", "failing", "config_invalid", "red"}


def s(state, alerted=None, alerted_at=None):
    return {"state": state, "alerted": state in BAD if alerted is None else alerted, "alerted_at": alerted_at}


class DiffTests(unittest.TestCase):
    def test_first_sighting_healthy_says_nothing(self):
        self.assertEqual(diff({}, {"a::x": s("healthy")}, NOW), [])

    def test_first_sighting_already_bad_alerts(self):
        self.assertEqual(kinds({}, {"a::x": s("failing")}), {"a::x": "alert"})

    def test_moving_into_a_bad_state_alerts(self):
        for bad in ("overdue", "stuck", "failing", "config_invalid"):
            self.assertEqual(kinds({"a::x": s("healthy")}, {"a::x": s(bad)}), {"a::x": "alert"}, bad)

    def test_staying_bad_does_not_repeat(self):
        self.assertEqual(diff({"a::x": s("failing")}, {"a::x": s("failing")}, NOW), [])

    def test_moving_between_bad_states_is_the_same_announced_problem(self):
        self.assertEqual(diff({"a::x": s("failing")}, {"a::x": s("overdue")}, NOW), [])

    def test_a_flap_inside_the_cooldown_is_not_announced_again(self):
        recent = datetime(2026, 11, 18, 11, 30, 0)
        previous = {"a::x": s("healthy", alerted=False, alerted_at=recent)}
        self.assertEqual(diff(previous, {"a::x": s("failing")}, NOW), [])

    def test_the_same_problem_is_announced_once_the_cooldown_has_passed(self):
        old = datetime(2026, 11, 18, 9, 0, 0)
        previous = {"a::x": s("healthy", alerted=False, alerted_at=old)}
        self.assertEqual(kinds(previous, {"a::x": s("failing")}), {"a::x": "alert"})

    def test_a_suppressed_problem_that_persists_is_announced_when_the_cooldown_ends(self):
        recent = datetime(2026, 11, 18, 11, 30, 0)
        stale = {"a::x": s("failing", alerted=False, alerted_at=recent)}
        self.assertEqual(diff(stale, {"a::x": s("failing")}, NOW), [])
        later = datetime(2026, 11, 18, 12, 31, 0)
        self.assertEqual([c["kind"] for c in diff(stale, {"a::x": s("failing")}, later)], ["alert"])

    def test_a_recovery_is_only_sent_for_a_problem_that_was_announced(self):
        quiet = {"a::x": s("failing", alerted=False)}
        self.assertEqual(diff(quiet, {"a::x": s("healthy")}, NOW), [])

    def test_recovery_is_reported_once(self):
        self.assertEqual(kinds({"a::x": s("failing")}, {"a::x": s("healthy")}), {"a::x": "recovery"})
        self.assertEqual(diff({"a::x": s("healthy")}, {"a::x": s("healthy")}, NOW), [])

    def test_warning_is_not_an_alert_and_counts_as_recovered(self):
        self.assertEqual(diff({"a::x": s("healthy")}, {"a::x": s("warning")}, NOW), [])
        self.assertEqual(kinds({"a::x": s("overdue")}, {"a::x": s("warning")}), {"a::x": "recovery"})

    def test_disabling_a_failing_function_is_silent(self):
        self.assertEqual(diff({"a::x": s("failing")}, {"a::x": s("disabled")}, NOW), [])

    def test_platform_red_alerts_and_ok_recovers(self):
        self.assertEqual(kinds({"platform::disk": s("ok")}, {"platform::disk": s("red")}), {"platform::disk": "alert"})
        self.assertEqual(diff({"platform::disk": s("warn")}, {"platform::disk": s("warn")}, NOW), [])
        self.assertEqual(kinds({"platform::disk": s("red")}, {"platform::disk": s("ok")}), {"platform::disk": "recovery"})

    def test_only_red_platform_checks_alert(self):
        for state in ("warn", "unknown", "ok"):
            self.assertEqual(diff({"platform::disk": s("ok")}, {"platform::disk": s(state)}, NOW), [], state)

    def test_a_connector_check_is_alerted_like_a_platform_check(self):
        key = "check::a::fresh"
        self.assertEqual(kinds({key: s("ok")}, {key: s("red")}), {key: "alert"})
        self.assertEqual(diff({key: s("ok")}, {key: s("warn")}, NOW), [])
        self.assertEqual(kinds({key: s("red")}, {key: s("ok")}), {key: "recovery"})

    def test_a_function_that_vanished_is_ignored(self):
        self.assertEqual(diff({"a::x": s("failing")}, {}, NOW), [])

    def test_each_change_carries_old_and_new(self):
        change = diff({"a::x": s("healthy")}, {"a::x": s("stuck")}, NOW)[0]
        self.assertEqual((change["old"], change["new"]), ("healthy", "stuck"))


if __name__ == "__main__":
    unittest.main()
