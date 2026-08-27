"""One-off script: provision the service account the Slack bot uses to call
alaiy_os.api.chat.* (see alaiy_os_slack_bot/README.md at the bench root).

Run with:
    bench --site <site> execute alaiy_os.setup.create_slack_bot_user.run
"""

import frappe
from frappe.core.doctype.user.user import generate_keys

EMAIL = "slack-bot@alaiy.local"
# Accounts User: the R1/R6 tools read Sales Invoice for GMV, which "Sales
# User"/"Stock User" alone do not cover (confirmed live -- see the commit
# message / conversation this script came from: the daily-digest skill
# looped to max_turns and failed under those two roles alone).
ROLES = ("Sales User", "Stock User", "Accounts User")


def run():
	if frappe.db.exists("User", EMAIL):
		user = frappe.get_doc("User", EMAIL)
		print(f"already exists: {EMAIL}")
	else:
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": EMAIL,
				"first_name": "Slack Bot",
				"send_welcome_email": 0,
				"user_type": "System User",
				"roles": [{"role": role} for role in ROLES],
			}
		)
		user.insert(ignore_permissions=True)
		print(f"created {EMAIL}")

	existing_roles = {r.role for r in user.roles}
	missing = [role for role in ROLES if role not in existing_roles]
	if missing:
		for role in missing:
			user.append("roles", {"role": role})
		user.save(ignore_permissions=True)
		print("added missing roles:", missing)

	keys = generate_keys(EMAIL)
	with open("/tmp/slack_bot_api_secret.txt", "w") as f:
		f.write(keys["api_secret"])

	frappe.db.commit()
	print("EMAIL:", EMAIL)
	print("API_KEY:", keys["api_key"])
	print("API_SECRET: written to /tmp/slack_bot_api_secret.txt")
	print("ROLES:", [r.role for r in frappe.get_doc("User", EMAIL).roles])
