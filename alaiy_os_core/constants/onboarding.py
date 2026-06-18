"""
AlaiyOS Module Onboarding configuration.

Set ENABLE_MODULE_ONBOARDING = True in client/config/boot_config.py to activate
Getting Started on the workspace sidebar.

Edit ONBOARDING_STEPS to customise what the onboarding guide shows.
Each step is a dict that maps to a Module Onboarding Step doctype record.
"""

ONBOARDING_NAME = "Alaiy OS Onboarding"

# Steps shown in the Getting Started sidebar panel.
# Fields match the Module Onboarding Step doctype schema in Frappe v16.
ONBOARDING_STEPS = [
    {
        "title":        "Set up your Company",
        "description":  "Enter your company's name, address, and default currency.",
        "action":       "Update Settings",
        "action_label": "Open Company Settings",
        "doc_type":     "Company",
        "is_mandatory": 1,
    },
    {
        "title":        "Add your first Product",
        "description":  "Create an Item to start tracking inventory.",
        "action":       "Create Entry",
        "action_label": "Create Product",
        "doc_type":     "Item",
        "is_mandatory": 1,
    },
    {
        "title":        "Create a Sales Order",
        "description":  "Record your first customer order.",
        "action":       "Create Entry",
        "action_label": "New Sales Order",
        "doc_type":     "Sales Order",
        "is_mandatory": 0,
    },
    {
        "title":        "Add a Supplier",
        "description":  "Register a supplier for procurement.",
        "action":       "Create Entry",
        "action_label": "New Supplier",
        "doc_type":     "Supplier",
        "is_mandatory": 0,
    },
]
