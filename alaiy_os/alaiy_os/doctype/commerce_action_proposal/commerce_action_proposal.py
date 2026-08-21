# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

# One code per action_type, used only for the autoname pattern
# (CAP-PRICE-00001, CAP-REORDER-00001, ...).
_ACTION_TYPE_CODE = {
	"Price Update": "PRICE",
	"Reorder PO": "REORDER",
	"Ad Spend": "ADSPEND",
	"Listing Edit": "LISTING",
}


class CommerceActionProposal(Document):
	def validate(self):
		self.action_type_code = _ACTION_TYPE_CODE.get(self.action_type, "OTHER")
		self._guard_approval_needs_reconciliation()

	def _guard_approval_needs_reconciliation(self):
		# Belt-and-suspenders: even if a reviewer's UI let them tap "Approved" on
		# a row the reconciliation step itself marked unsafe, the doctype layer
		# refuses the transition. reconciliation_ok is set by the proposing tool,
		# never by a human, so this is checking the agent's own finding, not
		# second-guessing a person.
		if self.status == "Approved" and not self.reconciliation_ok:
			frappe.throw(
				"This proposal's reconciliation check did not pass "
				f"({self.block_reason or 'no reason recorded'}) — it cannot be approved "
				"until the underlying mismatch is resolved and it's re-proposed."
			)

	def on_update(self):
		before = self.get_doc_before_save()
		became_approved = self.status == "Approved" and (before is None or before.status != "Approved")
		if not became_approved:
			return

		self.db_set("approved_by", frappe.session.user, update_modified=False)
		self.db_set("approved_on", now_datetime(), update_modified=False)

		if self.capital_pool and self.amount_requested:
			self._deploy_capital()

		self._execute()

	def _deploy_capital(self):
		pool = frappe.get_doc("Commerce Capital Pool", self.capital_pool)
		pool.deploy(self.amount_requested, reason=f"Approved {self.name} ({self.action_type} on {self.item})")

	def _execute(self):
		# Import here, not at module load: commerce/tools.py can depend on
		# connector apps that may not be installed on every site running this
		# doctype, and a proposal for an action_type whose connector isn't
		# installed should fail as "Execution Failed" on that one row, not break
		# every Commerce Action Proposal save on the whole site.
		from alaiy_os.commerce import tools

		dispatch = {
			"Price Update": tools.execute_price_update,
			"Reorder PO": tools.execute_reorder,
			"Ad Spend": tools.execute_ad_spend,
			"Listing Edit": tools.execute_listing_edit,
		}
		handler = dispatch.get(self.action_type)
		if handler is None:
			self._mark_execution_failed(f"No executor registered for action_type '{self.action_type}'.")
			return

		try:
			handler(self)
		except Exception as e:
			frappe.log_error(
				title=f"Commerce Action Proposal execution failed: {self.name}",
				message=frappe.get_traceback(),
			)
			self._mark_execution_failed(str(e))
		else:
			self.db_set("status", "Executed", update_modified=False)
			self.db_set("executed_on", now_datetime(), update_modified=False)

	def _mark_execution_failed(self, message):
		self.db_set("status", "Execution Failed", update_modified=False)
		self.db_set("execution_error", message, update_modified=False)
