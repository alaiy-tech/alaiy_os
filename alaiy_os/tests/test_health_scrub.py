# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt
"""Error text shown on the page and sent to Slack must never carry a secret.

Errors from connectors have included keys inside tracebacks and request URLs, so scrubbing is a
rule of the page, not a courtesy.
"""

import unittest

from alaiy_os.health.scrub import scrub


class ScrubTests(unittest.TestCase):
    def test_a_readable_message_is_kept(self):
        self.assertEqual(scrub("401 Unauthorized"), "401 Unauthorized")

    def test_only_the_first_line_is_kept(self):
        text = "Request failed\nTraceback (most recent call last):\n  password=hunter2"
        self.assertEqual(scrub(text), "Request failed")

    def test_a_python_traceback_is_reduced_to_its_exception_line(self):
        text = ('Traceback (most recent call last):\n  File "/apps/x/y.py", line 3, in run\n    fetch()\n'
                "requests.exceptions.ConnectionError: could not reach the host")
        self.assertEqual(scrub(text), "requests.exceptions.ConnectionError: could not reach the host")

    def test_the_exception_line_of_a_traceback_is_scrubbed_too(self):
        text = "Traceback (most recent call last):\n  File x\nValueError: rejected token=abc123secret\n\n"
        out = scrub(text)
        self.assertTrue(out.startswith("ValueError: rejected"))
        self.assertNotIn("abc123secret", out)

    def test_a_traceback_with_only_its_header_keeps_the_header(self):
        self.assertEqual(scrub("Traceback (most recent call last):"), "Traceback (most recent call last):")

    def test_a_bearer_token_is_hidden(self):
        out = scrub("Rejected: Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature")
        self.assertNotIn("eyJhbGci", out)
        self.assertIn("Rejected", out)

    def test_a_key_in_a_query_string_is_hidden(self):
        out = scrub("GET https://api.example.com/v1/items?api_key=abc123&page=2 returned 500")
        self.assertNotIn("abc123", out)
        self.assertIn("api.example.com/v1/items", out)

    def test_any_query_string_is_hidden_even_without_a_secret_looking_name(self):
        out = scrub("GET https://api.example.com/v1/items?sig=zz9plural&page=2 returned 500")
        self.assertNotIn("zz9plural", out)
        self.assertIn("returned 500", out)

    def test_assignments_to_secret_names_are_hidden(self):
        for text in ("token=abc123", 'password: "hunter2"', "secret = s3cr3t", '"api_key": "k-123"'):
            out = scrub(f"failed with {text}")
            for leaked in ("abc123", "hunter2", "s3cr3t", "k-123"):
                self.assertNotIn(leaked, out, text)

    def test_compound_credential_names_are_hidden(self):
        cases = ['"client_secret": "abc123"', "access_token=abc123", "refresh_token: abc123", "X-Api-Token: abc123",
                 "Authorization: Basic abc123", "db_password=abc123", "apikey=abc123", "client_credential=abc123"]
        for text in cases:
            self.assertNotIn("abc123", scrub(f"call failed ({text})"), text)

    def test_a_long_secret_like_string_is_hidden(self):
        out = scrub("bad credentials 3f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a")
        self.assertNotIn("3f9a8b7c", out)

    def test_ordinary_long_words_in_a_sentence_survive(self):
        self.assertEqual(scrub("Connection to the warehouse service timed out"), "Connection to the warehouse service timed out")

    def test_length_is_capped(self):
        self.assertLessEqual(len(scrub("x " * 500, max_len=50)), 50)

    def test_empty_and_none(self):
        self.assertEqual(scrub(None), "")
        self.assertEqual(scrub(""), "")


if __name__ == "__main__":
    unittest.main()
