import json

import frappe
from frappe.model.document import Document


class OSAgentTool(Document):
	def validate(self):
		self._validate_handler()
		self._validate_parameters_schema()

	def _validate_handler(self):
		# Fail at save time, not mid-run: the dotted path must import and be callable.
		try:
			fn = frappe.get_attr(self.handler)
		except Exception:
			frappe.throw(f"Handler <code>{self.handler}</code> could not be imported.")
		if not callable(fn):
			frappe.throw(f"Handler <code>{self.handler}</code> is not callable.")

	def _validate_parameters_schema(self):
		if not self.parameters_schema:
			return
		try:
			schema = json.loads(self.parameters_schema)
		except ValueError:
			frappe.throw("Parameters Schema is not valid JSON.")
		if not isinstance(schema, dict) or schema.get("type") != "object":
			frappe.throw('Parameters Schema must be a JSON Schema object with "type": "object".')
