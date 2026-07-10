"""
AlaiyOS custom onboarding wizard — backend.

Serves the data needed to render /os/onboarding and, on final submit, drives
company/branding/defaults setup by calling Frappe's and ERPNext's own
setup-wizard completion functions directly (frappe.desk.page.setup_wizard and
erpnext.setup.setup_wizard.operations.install_fixtures) so this wizard's data
maps onto the exact same doctypes the native setup wizard would use, and the
native wizard's own "setup complete" flags get marked done too — see
alaiy_os/www/os/onboarding.py for the page that serves this.
"""

import json

import frappe


def is_onboarding_complete():
    if not frappe.db.exists("DocType", "Alaiy OS Onboarding Settings"):
        return False
    return bool(frappe.db.get_single_value("Alaiy OS Onboarding Settings", "is_complete"))


@frappe.whitelist(allow_guest=True)
def get_wizard_data():
    """Bootstrap data needed to render all 4 steps of the onboarding wizard."""
    from frappe.desk.page.setup_wizard.setup_wizard import load_languages
    from frappe.geo.country_info import get_country_timezone_info

    region = get_country_timezone_info()

    return {
        "already_complete": is_onboarding_complete(),
        "languages": load_languages(),
        "country_info": region.get("country_info"),
        "uoms": frappe.get_all("UOM", pluck="name", order_by="name asc"),
        "currencies": frappe.get_all(
            "Currency", filters={"enabled": 1}, pluck="name", order_by="name asc"
        ),
    }


@frappe.whitelist(allow_guest=True)
def get_chart_of_accounts_options(country):
    from erpnext.accounts.doctype.account.chart_of_accounts.chart_of_accounts import (
        get_charts_for_country,
    )

    return get_charts_for_country(country, with_standard=True)


@frappe.whitelist(allow_guest=True)
def preview_chart_of_accounts(chart_template):
    from erpnext.accounts.doctype.account.chart_of_accounts.chart_of_accounts import get_chart

    return get_chart(chart_template)


def _apply_logos(args):
    square_url = args.get("square_logo_url")
    hor_url = args.get("hor_logo_url")

    if square_url:
        company = frappe.db.get_value(
            "Company", {"company_name": args.get("company_name")}, "name"
        )
        if company:
            frappe.db.set_value("Company", company, "company_logo", square_url)
        frappe.db.set_single_value("Website Settings", "favicon", square_url)

    if hor_url:
        frappe.db.set_single_value("Navbar Settings", "app_logo", hor_url)


def _configure_navbar():
    navbar = frappe.get_single("Navbar Settings")
    navbar.set("settings_dropdown", [])
    navbar.set("help_dropdown", [])
    navbar.append(
        "help_dropdown",
        {
            "item_label": "About Alaiy OS",
            "item_type": "Route",
            "route": "https://os.alaiy.com",
        },
    )
    navbar.append(
        "help_dropdown",
        {
            "item_label": "Keyboard Shortcuts",
            "item_type": "Action",
            "action": "frappe.ui.toolbar.show_shortcuts(event)",
        },
    )
    navbar.flags.ignore_mandatory = True
    navbar.save(ignore_permissions=True)


def _delete_welcome_workspace():
    if frappe.db.exists("Workspace Sidebar", "Welcome Workspace"):
        frappe.delete_doc("Workspace Sidebar", "Welcome Workspace", ignore_permissions=True, force=True)
    if frappe.db.exists("Workspace", "Welcome Workspace"):
        frappe.delete_doc("Workspace", "Welcome Workspace", ignore_permissions=True, force=True)


def _delete_desktop_page():
    if not frappe.db.exists("Page", "desktop"):
        return
    # Page.on_trash() throws outside developer mode unless this flag is set —
    # Frappe core's own drop_unused_pages patch relies on the same toggle.
    frappe.flags.in_migrate = True
    try:
        frappe.delete_doc("Page", "desktop", ignore_permissions=True, force=True)
    finally:
        frappe.flags.in_migrate = False


@frappe.whitelist(allow_guest=True)
def complete_onboarding(args):
    """
    Single entrypoint that completes AlaiyOS's onboarding wizard. Callable as
    Guest by design — there's no account to authenticate as on a fresh
    install, and this is the one whitelisted method that's ever allowed to
    create Administrator-equivalent state without an existing session. The
    is_onboarding_complete() guard below is what makes that safe: once it's
    run once, every subsequent call (Guest or otherwise) is a no-op forever.

    Collects all 4 steps' data at once (matching the native wizard's own
    submit-at-the-end model) and, in order, applies it via the real
    Frappe/ERPNext setup-wizard functions, then AlaiyOS-specific settings,
    then marks both the native wizard and our own flag complete, then logs
    the calling session in as the just-created user.
    """
    if is_onboarding_complete():
        return {"status": "ok", "redirect_to": "/desk/os"}

    if isinstance(args, str):
        args = json.loads(args)
    args = frappe._dict(args)

    from frappe.desk.page.setup_wizard.setup_wizard import (
        create_or_update_user,
        disable_future_access,
        enable_setup_wizard_complete,
        set_timezone,
        update_system_settings,
    )
    from erpnext.setup.setup_wizard.operations import install_fixtures

    # Step 1 — Welcome (language, country, timezone, currency)
    update_system_settings(args)

    # Step 2 — Account (full name, email, password)
    create_or_update_user(args)
    set_timezone(args)

    # Step 3 — Organization (company, CoA, fiscal year, + standard ERPNext presets)
    install_fixtures.install(args.get("country"))
    install_fixtures.install_company(args)
    install_fixtures.set_global_defaults(args)
    if args.get("default_distance_unit"):
        frappe.db.set_single_value(
            "Global Defaults", "default_distance_unit", args.get("default_distance_unit")
        )

    # Step 4 — Organizational assets (logos)
    _apply_logos(args)

    # AlaiyOS-specific settings
    frappe.db.set_single_value("Global Defaults", "hide_currency_symbol", "No")
    frappe.db.set_single_value("System Settings", "disable_system_update_notification", 1)
    _configure_navbar()
    frappe.db.set_single_value("Portal Settings", "default_portal_home", "/desk/os")
    _delete_welcome_workspace()
    _delete_desktop_page()

    # Mark Frappe's/ERPNext's own setup wizard complete so it never appears
    enable_setup_wizard_complete("frappe")
    enable_setup_wizard_complete("erpnext")
    disable_future_access()

    # Our own completion flag
    settings = frappe.get_single("Alaiy OS Onboarding Settings")
    settings.is_complete = 1
    settings.completed_by = frappe.session.user
    settings.completed_on = frappe.utils.now_datetime()
    settings.flags.ignore_mandatory = True
    settings.save(ignore_permissions=True)

    frappe.db.commit()
    frappe.clear_cache()

    # Log the (Guest) request in as the account just created in Step 2, so the
    # client's redirect to /desk/os lands in an already-authenticated session —
    # mirrors frappe.desk.page.setup_wizard.setup_wizard.login_as_first_user().
    if args.get("email") and hasattr(frappe.local, "login_manager"):
        frappe.local.login_manager.login_as(args.get("email"))

    return {"status": "ok", "redirect_to": "/desk/os"}
