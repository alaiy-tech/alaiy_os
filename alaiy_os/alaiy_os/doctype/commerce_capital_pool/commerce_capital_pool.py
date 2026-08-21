# Copyright (c) 2026, Alaiy and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CommerceCapitalPool(Document):
	"""A working-capital tranche the Commerce Pilot agent may deploy against.

	Deliberately conservative: total_capital is set once at creation and never
	edited — scaling the pool means adding a new Pool ID row for the next
	tranche, not raising this one's ceiling, so the "did the last tranche prove
	itself" question always has an unambiguous row to point at.
	"""

	def validate(self):
		self.available_capital = (self.total_capital or 0) - (self.deployed_capital or 0)
		if self.available_capital < 0:
			frappe.throw(
				f"Deployed capital ({self.deployed_capital}) exceeds total capital "
				f"({self.total_capital}) for pool '{self.pool_id}'."
			)

	def deploy(self, amount, reason):
		"""Reserve `amount` against this pool. Raises if it would overdraw."""
		if amount <= 0:
			frappe.throw("Deploy amount must be positive.")
		if amount > self.available_capital:
			frappe.throw(
				f"Pool '{self.pool_id}' has ₹{self.available_capital} available; "
				f"cannot deploy ₹{amount}."
			)
		self.deployed_capital = (self.deployed_capital or 0) + amount
		self.last_change_reason = reason
		self.save(ignore_permissions=True)

	def release(self, amount, reason):
		"""Free up capital — a proposal was rejected, or a bet was closed out."""
		if amount <= 0:
			frappe.throw("Release amount must be positive.")
		self.deployed_capital = max(0, (self.deployed_capital or 0) - amount)
		self.last_change_reason = reason
		self.save(ignore_permissions=True)


def get_active_pool():
	"""Return the single active Commerce Capital Pool, or None.

	Returns None rather than throwing so callers (e.g. a proposal tool) can
	surface "no active capital pool" as a normal blocked-reason rather than a
	crash — there may legitimately be no active pool between tranches.
	"""
	name = frappe.db.get_value("Commerce Capital Pool", {"is_active": 1}, "name")
	return frappe.get_doc("Commerce Capital Pool", name) if name else None
