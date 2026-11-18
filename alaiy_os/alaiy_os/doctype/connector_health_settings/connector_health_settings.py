import frappe
from frappe.model.document import Document

from alaiy_os.health.alerts import valid_webhook


class ConnectorHealthSettings(Document):
    def validate(self):
        value = self.slack_webhook or ""
        # An unchanged Password field comes back masked; only a newly typed value is checked.
        if value and set(value) != {"*"} and not valid_webhook(value):
            frappe.throw("The Slack webhook must be an https URL.")
        if self.alert_cooldown_minutes is not None and int(self.alert_cooldown_minutes) < 1:
            frappe.throw("The alert cooldown must be at least 1 minute.")
