"""
Alaiy OS Module Onboarding configuration.

"Getting Started" panel appears in the workspace sidebar.  The Module Onboarding
and Onboarding Step records are always created in the DB regardless of that flag.

Each dict's keys (besides "name") are written straight onto an "Onboarding
Step" doc — keep them matching frappe.desk.doctype.onboarding_step's real
fields exactly. "doc_type" and "is_mandatory" used to be here but neither is
a real field on that doctype (nor on the "Onboarding Step Map" child table
Module Onboarding links them through) — they were silently dropped on
first insert (frappe.get_doc().insert() ignores unknown keys) but raised
"Unknown column" on every later bench migrate, where the record already
exists and gets updated via frappe.db.set_value(dt, name, {...}) instead,
which builds a raw UPDATE from these keys with no such filtering. The real
field for "which DocType this step is about" is reference_document.
"""

ONBOARDING_NAME = "Alaiy OS Onboarding"

ONBOARDING_STEPS = [
    {
        "name":               "Alaiy OS - Set up your Company",
        "title":              "Set up your Company",
        "description":        "Enter your company's name, address, and default currency.",
        "action":             "Update Settings",
        "action_label":       "Open Company Settings",
        "reference_document": "Company",
    },
    {
        "name":               "Alaiy OS - Add your first Product",
        "title":              "Add your first Product",
        "description":        "Create an Item to start tracking inventory.",
        "action":             "Create Entry",
        "action_label":       "Create Product",
        "reference_document": "Item",
    },
    {
        "name":               "Alaiy OS - Create a Sales Order",
        "title":              "Create a Sales Order",
        "description":        "Record your first customer order.",
        "action":             "Create Entry",
        "action_label":       "New Sales Order",
        "reference_document": "Sales Order",
    },
    {
        "name":               "Alaiy OS - Add a Supplier",
        "title":              "Add a Supplier",
        "description":        "Register a supplier for procurement.",
        "action":             "Create Entry",
        "action_label":       "New Supplier",
        "reference_document": "Supplier",
    },
]
