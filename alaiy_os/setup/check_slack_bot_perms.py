"""One-off diagnostic: does slack-bot@alaiy.local actually have read access to
what the report agents' tools need?

Run with:
    bench --site <site> execute alaiy_os.setup.check_slack_bot_perms.run
"""

import frappe

DOCTYPES = ["Sales Invoice", "Sales Order", "Sales Invoice Item", "Item", "Bin"]


def run():
	for doctype in DOCTYPES:
		roles = frappe.get_all("DocPerm", filters={"parent": doctype, "read": 1}, pluck="role")
		print(doctype, "-> read roles:", sorted(set(roles)))

	print()
	print("--- has_permission as slack-bot@alaiy.local ---")
	frappe.set_user("slack-bot@alaiy.local")
	for doctype in DOCTYPES:
		print(doctype, "read:", frappe.has_permission(doctype, "read"))
