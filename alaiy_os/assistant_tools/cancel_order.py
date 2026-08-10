"""cancel_order -- cancel a Sales Order and its downstream documents.

A dry run returns the cascade preview (what would be cancelled) and makes no
changes -- this is safe for Alaiy Ops. An actual cancel (dry_run=false) is
destructive and is gated to Alaiy Admin. Downstream docs are cancelled
most-dependent first: Payment Entry -> Sales Invoice -> Delivery Note ->
Pick List -> the Sales Order itself.
"""

from typing import Any, Dict, List, Tuple

import frappe

from alaiy_os.assistant_tools._base import AlaiyTool

# (DocType, child table, link field on the child pointing at the Sales Order).
# Ordered most-downstream first so cancellation respects dependencies.
_DOWNSTREAM: List[Tuple[str, str, str]] = [
    ("Payment Entry", "Payment Entry Reference", "reference_name"),  # reference_doctype=Sales Order (advances)
    ("Sales Invoice", "Sales Invoice Item", "sales_order"),
    ("Delivery Note", "Delivery Note Item", "against_sales_order"),
    ("Pick List", "Pick List Item", "sales_order"),
]


class CancelOrder(AlaiyTool):
    def __init__(self):
        super().__init__()
        self.name = "cancel_order"
        self.description = (
            "Cancel a Sales Order and all downstream documents in the correct order. "
            "With dry_run=true (default) it returns a cascade preview of exactly what "
            "would be cancelled, changing nothing. With dry_run=false it performs the "
            "cancellation -- this is destructive and requires the Alaiy Admin role."
        )
        self.inputSchema = {
            "type": "object",
            "properties": {
                "sales_order": {"type": "string", "description": "Sales Order name to cancel."},
                "reason": {"type": "string", "description": "Why it is being cancelled (recorded on the order)."},
                "dry_run": {
                    "type": "boolean",
                    "default": True,
                    "description": "Preview only (true) or actually cancel (false).",
                },
            },
            "required": ["sales_order"],
        }

    def run(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        self.require(arguments, "sales_order")
        so_name = arguments["sales_order"]
        reason = arguments.get("reason")
        dry_run = arguments.get("dry_run", True)

        # Enforce the destructive-action gate first, before any DB work, so the
        # permission decision never depends on whether the order happens to exist.
        if not dry_run:
            self.require_admin("Cancelling a Sales Order")

        if not frappe.db.exists("Sales Order", so_name):
            return self.fail(f"Sales Order '{so_name}' not found.")

        so_docstatus = frappe.db.get_value("Sales Order", so_name, "docstatus")
        cascade = self._build_cascade(so_name, so_docstatus)

        if dry_run:
            return self.ok(
                dry_run=True,
                sales_order=so_name,
                will_cancel=cascade,
                count=len(cascade),
                note="Nothing was changed. Re-run with dry_run=false (Alaiy Admin) to cancel.",
            )

        # Destructive path (admin already enforced above).
        if not cascade:
            return self.ok(
                dry_run=False,
                sales_order=so_name,
                cancelled=[],
                note="Nothing to cancel (already cancelled/draft).",
            )

        cancelled = []
        for entry in cascade:
            try:
                doc = frappe.get_doc(entry["doctype"], entry["name"])
                doc.cancel()
                cancelled.append(entry)
            except Exception as e:
                frappe.db.rollback()
                frappe.log_error(frappe.get_traceback(), f"cancel_order {entry['doctype']} {entry['name']}")
                return self.fail(
                    f"Failed cancelling {entry['doctype']} {entry['name']}: {e}. Rolled back; nothing was cancelled.",
                    cancelled_before_failure=cancelled,
                )

        if reason and frappe.db.has_column("Sales Order", "order_notes"):
            frappe.db.set_value("Sales Order", so_name, "order_notes", f"Cancelled via MCP: {reason}")
        frappe.db.commit()
        return self.ok(dry_run=False, sales_order=so_name, cancelled=cancelled, count=len(cancelled))

    def _build_cascade(self, so_name: str, so_docstatus: int) -> List[Dict[str, str]]:
        cascade: List[Dict[str, str]] = []
        for doctype, child_table, link_field in _DOWNSTREAM:
            if not frappe.db.exists("DocType", doctype):
                continue
            if doctype == "Payment Entry":
                conditions = (
                    "child.reference_doctype = 'Sales Order' AND child.reference_name = %(so)s "
                    "AND parent_doc.docstatus = 1"
                )
            else:
                conditions = "child.`{0}` = %(so)s AND parent_doc.docstatus = 1".format(link_field)
            names = frappe.db.sql(
                """
                SELECT DISTINCT parent_doc.name
                FROM `tab{child}` child
                JOIN `tab{dt}` parent_doc ON parent_doc.name = child.parent
                WHERE {conditions}
                """.format(child=child_table, dt=doctype, conditions=conditions),
                {"so": so_name},
                as_dict=True,
            )
            for r in names:
                cascade.append({"doctype": doctype, "name": r["name"]})

        if so_docstatus == 1:
            cascade.append({"doctype": "Sales Order", "name": so_name})
        return cascade
