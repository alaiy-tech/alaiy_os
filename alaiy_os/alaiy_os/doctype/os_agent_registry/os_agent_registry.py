import json
import re

import frappe
from frappe.model.document import Document

SKILL_SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class OSAgentRegistry(Document):
	def validate(self):
		if self.max_turns and self.max_turns < 1:
			frappe.throw("Max Turns must be at least 1.")
		if self.output_format == "JSON":
			self._validate_output_schema()
		self._validate_unique_tool_ids()
		self._validate_skill()

	def _validate_output_schema(self):
		if not self.output_schema:
			frappe.throw("Output Schema is required when Output Format is JSON.")
		try:
			schema = json.loads(self.output_schema)
		except ValueError:
			frappe.throw("Output Schema is not valid JSON.")
		if not isinstance(schema, dict):
			frappe.throw("Output Schema must be a JSON object.")

	def _validate_skill(self):
		"""Slug hygiene for agents exposed in Ask Alaiy as `/skills`.

		The slug is what the user types, so it has to survive being parsed out of
		a message: no spaces, no leading slash, and unique across the site — the
		picker resolves a slug to exactly one agent (see `chat/skills.py`).
		"""
		if not self.chat_skill:
			# Keep the row honest rather than leaving a slug that resolves to
			# nothing: `catalogue()` filters on chat_skill, so a stale value here
			# would only ever mislead someone reading the record.
			self.skill_slug = None
			self.skill_label = None
			return

		self.skill_slug = (self.skill_slug or "").strip().lstrip("/").lower()
		if not SKILL_SLUG.match(self.skill_slug):
			frappe.throw(
				f"Skill Slug <code>{self.skill_slug}</code> is not valid — use lowercase "
				"letters, digits and single hyphens, e.g. <code>daily-digest</code>."
			)

		clash = frappe.db.get_value(
			"OS Agent Registry",
			{"skill_slug": self.skill_slug, "chat_skill": 1, "name": ("!=", self.name)},
			"name",
		)
		if clash:
			frappe.throw(f"Skill Slug <code>{self.skill_slug}</code> is already used by agent {clash}.")

	def _validate_unique_tool_ids(self):
		seen = set()
		for row in self.tools:
			if row.tool_id in seen:
				frappe.throw(f"Duplicate tool_id <code>{row.tool_id}</code> in Tools.")
			seen.add(row.tool_id)
