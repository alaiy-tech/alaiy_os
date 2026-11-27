from frappe.model.document import Document


class OSConnectorHealthState(Document):
    """The last known health state of one connector function or platform check.

    Written only by the connector health job; read by the Connector Health page and used to decide
    when a change deserves an alert.
    """
