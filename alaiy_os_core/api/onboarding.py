"""
Onboarding API — called by the frontend OnboardingModal on first setup.
"""

import frappe


@frappe.whitelist()
def get_onboarding_status() -> dict:
    settings = frappe.get_single("Alaiy OS Settings")
    return {
        "onboarding_complete": bool(settings.onboarding_complete),
        "company_exists": bool(frappe.db.get_single_value("Global Defaults", "default_company")),
    }


@frappe.whitelist()
def complete_company_onboarding(
    company_name: str,
    company_abbr: str,
    currency: str,
    country: str,
) -> dict:
    """
    First-time company setup. Idempotent — safe to call again if partial.
    Creates the Company, sets Global Defaults and System Settings, marks
    onboarding complete in Alaiy OS Settings.
    """
    if not all([company_name, company_abbr, currency, country]):
        frappe.throw("company_name, company_abbr, currency, and country are all required")

    # ── Company ────────────────────────────────────────────────────────
    if not frappe.db.exists("Company", company_name):
        company = frappe.new_doc("Company")
        company.company_name = company_name
        company.abbr = company_abbr
        company.default_currency = currency
        company.country = country
        company.insert(ignore_permissions=True)
        frappe.logger().info(f"AlaiyOS: created Company '{company_name}'")

    # ── Fiscal Year ────────────────────────────────────────────────────
    _ensure_fiscal_year(company_name)

    # ── Global Defaults ────────────────────────────────────────────────
    gd = frappe.get_single("Global Defaults")
    gd.default_company = company_name
    gd.default_currency = currency
    gd.save(ignore_permissions=True)

    # ── System Settings ────────────────────────────────────────────────
    ss = frappe.get_single("System Settings")
    ss.country = country
    ss.save(ignore_permissions=True)

    # ── Mark complete ──────────────────────────────────────────────────
    settings = frappe.get_single("Alaiy OS Settings")
    settings.onboarding_complete = 1
    settings.save(ignore_permissions=True)

    frappe.db.commit()
    frappe.logger().info("AlaiyOS: company onboarding complete")
    return {"success": True}


def _ensure_fiscal_year(company_name: str) -> None:
    import frappe.utils

    year = frappe.utils.now_datetime().year
    fy_name = str(year)

    if frappe.db.exists("Fiscal Year", fy_name):
        return

    fy = frappe.new_doc("Fiscal Year")
    fy.year = fy_name
    fy.year_start_date = f"{year}-01-01"
    fy.year_end_date = f"{year}-12-31"
    try:
        fy.insert(ignore_permissions=True)
        frappe.db.set_value("Fiscal Year Company", None, "company", company_name, update_modified=False)
    except Exception:  # noqa: BLE001
        # Fiscal year may already exist with different name — not fatal
        pass
