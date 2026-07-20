"""Retire OS Agent, OS Agent Tool Link, and the standalone OS Agent Tool.

Agent definitions now live in installable agent apps, each self-registering a
row in OS Agent Registry (see the agent app template). Core keeps only
OS Agent Registry, its OS Agent Tool child table, and OS Agent Run.

Runs pre_model_sync so these tables are gone before the schema sync:
  - "OS Agent" and "OS Agent Tool Link" are removed for good — their JSON has
    been deleted from the app, so the sync will not recreate them.
  - "OS Agent Tool" is dropped here and recreated by the sync as a CHILD table
    (its istable flag flips 0 -> 1); dropping first avoids an in-place ALTER on
    a doctype whose fundamental type changed.

Existing agent/tool records are intentionally discarded — agent apps
re-register on their own install/migrate. OS Agent Run history is left intact.
"""

import frappe

DOCTYPES = ["OS Agent", "OS Agent Tool Link", "OS Agent Tool"]


def execute():
	for doctype in DOCTYPES:
		if frappe.db.exists("DocType", doctype):
			frappe.delete_doc("DocType", doctype, force=True, ignore_permissions=True)
		frappe.db.sql_ddl(f"DROP TABLE IF EXISTS `tab{doctype}`")
	frappe.db.commit()
