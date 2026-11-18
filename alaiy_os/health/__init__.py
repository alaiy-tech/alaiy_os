"""Connector health: one contract for every connector, one state engine, one set of platform checks.

`intervals` and `engine` are plain Python (no Frappe import) so the rules can be tested without a
bench. `runs`, `platform` and `service` are the Frappe-facing parts.
"""
