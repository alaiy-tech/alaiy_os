"""
Onboarding API — called by the frontend OnboardingModal on first setup.
"""

import datetime
import frappe


@frappe.whitelist()
def get_onboarding_status() -> dict:
    settings = frappe.get_single("Alaiy OS Settings")
    return {
        "onboarding_complete": bool(settings.onboarding_complete),
        "company_exists": bool(
            frappe.db.get_single_value("Global Defaults", "default_company")
        ),
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

    Order matters:
      1. System Settings  (language + time_zone are mandatory, must exist first)
      2. Warehouse Types  (ERPNext creates warehouses on company insert)
      3. Company          (triggers default warehouse + cost centre creation)
      4. Fiscal Year
      5. Global Defaults
      6. Mark onboarding complete
    """

    if not all([company_name, company_abbr, currency, country]):
        frappe.throw(
            "company_name, company_abbr, currency, and country are all required.")

    # ── 1. System Settings ─────────────────────────────────────────────────
    _setup_system_settings(country)

    # ── 2. Warehouse Types ─────────────────────────────────────────────────
    _setup_warehouse_types()

    # ── 3. Company ─────────────────────────────────────────────────────────
    if not frappe.db.exists("Company", company_name):
        company = frappe.new_doc("Company")
        company.company_name = company_name
        company.abbr = company_abbr.upper()
        company.default_currency = currency
        company.country = country
        company.insert(ignore_permissions=True)
        frappe.logger().info(f"AlaiyOS: created Company '{company_name}'")

    # ── 4. Fiscal Year ─────────────────────────────────────────────────────
    _ensure_fiscal_year(company_name)

    # ── 5. Global Defaults ─────────────────────────────────────────────────
    gd = frappe.get_single("Global Defaults")
    gd.default_company = company_name
    gd.default_currency = currency
    gd.country = country
    gd.save(ignore_permissions=True)

    # ── 6. Mark onboarding complete ────────────────────────────────────────
    settings = frappe.get_single("Alaiy OS Settings")
    settings.onboarding_complete = 1
    settings.save(ignore_permissions=True)

    frappe.db.commit()
    frappe.logger().info("AlaiyOS: company onboarding complete")
    return {"success": True, "company": company_name}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _setup_system_settings(country: str) -> None:
    """
    Set language and time_zone before anything else — they are mandatory
    fields on System Settings and ERPNext validates them during company
    creation.
    """
    tz_map = {
        "India":         "Asia/Kolkata",
        "United States": "America/New_York",
        "Italy":         "Europe/Rome",
        "United Kingdom": "Europe/London",
        "Singapore":     "Asia/Singapore",
        "UAE":           "Asia/Dubai",
    }
    ss = frappe.get_single("System Settings")
    # Only set if blank — don't overwrite values an admin has set
    if not ss.language:
        ss.language = "en"
    if not ss.time_zone:
        ss.time_zone = tz_map.get(country, "UTC")
    ss.country = country
    # ignore_mandatory so a half-configured instance doesn't block us
    ss.flags.ignore_mandatory = True
    ss.save(ignore_permissions=True)


def _setup_warehouse_types() -> None:
    """
    ERPNext tries to create default warehouses (Stores, Work In Progress,
    Finished Goods, etc.) when a Company is inserted. Those warehouses
    require Warehouse Type records to exist first.
    """
    required = [
        "All",
        "Finished Goods",
        "Goods In Transit",
        "Return",
        "Stores",
        "Transit",
        "Work In Progress",
    ]
    for wt in required:
        if not frappe.db.exists("Warehouse Type", wt):
            doc = frappe.new_doc("Warehouse Type")
            doc.name = wt
            doc.insert(ignore_permissions=True)


def _ensure_fiscal_year(company_name: str) -> None:
    """
    Create an April–March fiscal year (India standard) for the current
    period. Falls back to calendar year for non-India regions.
    Safely handles the case where a fiscal year already exists.
    """
    today = datetime.date.today()

    # India: April 1 → March 31
    if today.month >= 4:
        fy_start = datetime.date(today.year,     4, 1)
        fy_end = datetime.date(today.year + 1, 3, 31)
    else:
        fy_start = datetime.date(today.year - 1, 4, 1)
        fy_end = datetime.date(today.year,     3, 31)

    fy_name = f"{fy_start.year}-{fy_end.year}"

    if frappe.db.exists("Fiscal Year", fy_name):
        # Ensure our company is linked to the existing fiscal year
        fy = frappe.get_doc("Fiscal Year", fy_name)
        existing = [r.company for r in fy.companies]
        if company_name not in existing:
            fy.append("companies", {"company": company_name})
            fy.save(ignore_permissions=True)
        return

    fy = frappe.new_doc("Fiscal Year")
    fy.year = fy_name
    fy.year_start_date = fy_start
    fy.year_end_date = fy_end
    fy.append("companies", {"company": company_name})
    fy.insert(ignore_permissions=True)
    frappe.logger().info(f"AlaiyOS: created Fiscal Year '{fy_name}'")
