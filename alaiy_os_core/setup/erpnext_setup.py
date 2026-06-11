"""
Automated ERPNext onboarding.

Replaces the browser setup wizard entirely.
All data sourced from .env via config/env.py.
Safe to re-run — every operation checks for existence first.
"""

import datetime

import frappe

from alaiy_os_core.config.loader import get_company_config


def setup_erpnext():
    """
    Entry point. Call before connector setup in after_install.
    Creates Company, Fiscal Year, Global Defaults, System Settings.
    """
    cfg = get_company_config()
    company_name = cfg["name"]
    abbr         = cfg["abbreviation"]
    currency     = cfg["currency"]
    country      = cfg["country"]

    frappe.logger().info(f"AlaiyOS: starting ERPNext setup for '{company_name}'")
    _create_company(company_name, abbr, currency, country)
    _create_fiscal_year(company_name)
    _set_global_defaults(company_name, currency, country)
    _set_system_settings(country)
    frappe.db.commit()
    frappe.logger().info("AlaiyOS: ERPNext setup complete")


# ── Company ───────────────────────────────────────────────────────────────────

def _create_company(name: str, abbr: str, currency: str, country: str):
    if frappe.db.exists("Company", name):
        frappe.logger().info(f"AlaiyOS: Company '{name}' already exists — skipping")
        return
    doc = frappe.new_doc("Company")
    doc.company_name     = name
    doc.abbr             = abbr
    doc.default_currency = currency
    doc.country          = country
    # Inserting a Company auto-creates: Chart of Accounts, default Warehouse, Cost Center
    doc.insert(ignore_permissions=True)
    frappe.logger().info(f"AlaiyOS: created Company '{name}'")


# ── Fiscal Year ───────────────────────────────────────────────────────────────

def _create_fiscal_year(company_name: str):
    today = datetime.date.today()
    # India fiscal year: April 1 → March 31
    if today.month >= 4:
        year_start = datetime.date(today.year,     4, 1)
        year_end   = datetime.date(today.year + 1, 3, 31)
    else:
        year_start = datetime.date(today.year - 1, 4, 1)
        year_end   = datetime.date(today.year,     3, 31)

    fy_name = f"{year_start.year}-{year_end.year}"

    if frappe.db.exists("Fiscal Year", fy_name):
        frappe.logger().info(f"AlaiyOS: Fiscal Year '{fy_name}' already exists")
        _add_company_to_fiscal_year(fy_name, company_name)
        return

    doc = frappe.new_doc("Fiscal Year")
    doc.year            = fy_name
    doc.year_start_date = year_start
    doc.year_end_date   = year_end
    doc.append("companies", {"company": company_name})
    doc.insert(ignore_permissions=True)
    frappe.logger().info(f"AlaiyOS: created Fiscal Year '{fy_name}'")


def _add_company_to_fiscal_year(fy_name: str, company_name: str):
    fy = frappe.get_doc("Fiscal Year", fy_name)
    if company_name not in [r.company for r in fy.companies]:
        fy.append("companies", {"company": company_name})
        fy.save(ignore_permissions=True)


# ── Global Defaults ───────────────────────────────────────────────────────────

def _set_global_defaults(company_name: str, currency: str, country: str):
    doc = frappe.get_single("Global Defaults")
    doc.default_company  = company_name
    doc.default_currency = currency
    doc.country          = country
    doc.save(ignore_permissions=True)
    frappe.logger().info("AlaiyOS: Global Defaults set")


# ── System Settings ───────────────────────────────────────────────────────────

def _set_system_settings(country: str):
    tz_map = {
        "India":         "Asia/Kolkata",
        "United States": "America/New_York",
        "Italy":         "Europe/Rome",
    }
    doc = frappe.get_single("System Settings")
    doc.country   = country
    doc.language  = "en"
    doc.time_zone = tz_map.get(country, "UTC")
    doc.save(ignore_permissions=True)
    frappe.logger().info("AlaiyOS: System Settings set")
