"""
Alaiy OS Module Onboarding configuration.

"Getting Started" panel appears in the workspace sidebar.  The Module Onboarding
and Onboarding Step records are always created in the DB regardless of that flag.
"""

ONBOARDING_NAME = "Alaiy OS Onboarding"

ONBOARDING_STEPS = [
    {
        "name":         "Alaiy OS - Set up your Company",
        "title":        "Set up your Company",
        "description":  "Enter your company's name, address, and default currency.",
        "action":       "Update Settings",
        "action_label": "Open Company Settings",
        "doc_type":     "Company",
        "is_mandatory": 1,
    },
    {
        "name":         "Alaiy OS - Add your first Product",
        "title":        "Add your first Product",
        "description":  "Create an Item to start tracking inventory.",
        "action":       "Create Entry",
        "action_label": "Create Product",
        "doc_type":     "Item",
        "is_mandatory": 1,
    },
    {
        "name":         "Alaiy OS - Create a Sales Order",
        "title":        "Create a Sales Order",
        "description":  "Record your first customer order.",
        "action":       "Create Entry",
        "action_label": "New Sales Order",
        "doc_type":     "Sales Order",
        "is_mandatory": 0,
    },
    {
        "name":         "Alaiy OS - Add a Supplier",
        "title":        "Add a Supplier",
        "description":  "Register a supplier for procurement.",
        "action":       "Create Entry",
        "action_label": "New Supplier",
        "doc_type":     "Supplier",
        "is_mandatory": 0,
    },
]
