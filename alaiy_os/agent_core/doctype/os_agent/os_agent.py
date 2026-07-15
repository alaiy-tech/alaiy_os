import json

import frappe
from frappe.model.document import Document


class OSAgent(Document):
	def validate(self):
		if self.max_turns and self.max_turns < 1:
			frappe.throw("Max Turns must be at least 1.")
		if self.output_format == "JSON":
			self._validate_output_schema()

	def _validate_output_schema(self):
		if not self.output_schema:
			frappe.throw("Output Schema is required when Output Format is JSON.")
		try:
			schema = json.loads(self.output_schema)
		except ValueError:
			frappe.throw("Output Schema is not valid JSON.")
		if not isinstance(schema, dict):
			frappe.throw("Output Schema must be a JSON object.")
