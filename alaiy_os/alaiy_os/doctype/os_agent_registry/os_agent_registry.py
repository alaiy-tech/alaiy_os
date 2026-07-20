import json

import frappe
from frappe.model.document import Document


class OSAgentRegistry(Document):
	def validate(self):
		if self.max_turns and self.max_turns < 1:
			frappe.throw("Max Turns must be at least 1.")
		if self.output_format == "JSON":
			self._validate_output_schema()
		self._validate_unique_tool_ids()

	def _validate_output_schema(self):
		if not self.output_schema:
			frappe.throw("Output Schema is required when Output Format is JSON.")
		try:
			schema = json.loads(self.output_schema)
		except ValueError:
			frappe.throw("Output Schema is not valid JSON.")
		if not isinstance(schema, dict):
			frappe.throw("Output Schema must be a JSON object.")

	def _validate_unique_tool_ids(self):
		seen = set()
		for row in self.tools:
			if row.tool_id in seen:
				frappe.throw(f"Duplicate tool_id <code>{row.tool_id}</code> in Tools.")
			seen.add(row.tool_id)
