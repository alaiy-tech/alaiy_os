"""
AlaiyOS environment configuration barrel.

Loads .env from the app root and exports all variables as typed Python constants.
Import pattern:
    from alaiy_os_core.config import env
    token = env.CLOUDSTORE_API_TOKEN
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# config/env.py → config/ → alaiy_os_core/ → alaiy_os_core/ → app root
_APP_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_PATH = _APP_ROOT / ".env"

# Load — silent if file doesn't exist (production may inject real env vars)
load_dotenv(dotenv_path=_ENV_PATH, override=False)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _str(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def _bool(key: str, default: bool = False) -> bool:
    val = os.getenv(key, "")
    if not val:
        return default
    return val.strip().lower() in ("true", "1", "yes")


def _int(key: str, default: int = 0) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except (TypeError, ValueError):
        return default


# ── Company ───────────────────────────────────────────────────────────────────

COMPANY_NAME     = _str("COMPANY_NAME",     "Altomoda")
COMPANY_ABBR     = _str("COMPANY_ABBR",     "ALT")
COMPANY_CURRENCY = _str("COMPANY_CURRENCY", "INR")
COMPANY_COUNTRY  = _str("COMPANY_COUNTRY",  "India")

# ── Cloudstore ────────────────────────────────────────────────────────────────

CLOUDSTORE_ENABLED          = _bool("CLOUDSTORE_ENABLED", False)
CLOUDSTORE_API_URL          = _str("CLOUDSTORE_API_URL")
CLOUDSTORE_API_TOKEN        = _str("CLOUDSTORE_API_TOKEN")
CLOUDSTORE_SUPPLIER_NAME    = _str("CLOUDSTORE_SUPPLIER_NAME",    "The Corner")
CLOUDSTORE_SUPPLIER_COUNTRY = _str("CLOUDSTORE_SUPPLIER_COUNTRY", "Italy")
CLOUDSTORE_PRICE_LIST_NAME  = _str("CLOUDSTORE_PRICE_LIST_NAME",  "Cloudstore Supplier Price")
CLOUDSTORE_PRICE_LIST_CCY   = _str("CLOUDSTORE_PRICE_LIST_CURRENCY", "EUR")
CLOUDSTORE_WAREHOUSE_NAME   = _str("CLOUDSTORE_WAREHOUSE_NAME",   "Altomoda Stores")
CLOUDSTORE_PAGE_SIZE        = _int("CLOUDSTORE_PAGE_SIZE",        50)

# ── Shopify ───────────────────────────────────────────────────────────────────

SHOPIFY_ENABLED      = _bool("SHOPIFY_ENABLED", False)
SHOPIFY_SHOP_URL     = _str("SHOPIFY_SHOP_URL")
SHOPIFY_ACCESS_TOKEN = _str("SHOPIFY_ACCESS_TOKEN")
SHOPIFY_WAREHOUSE    = _str("SHOPIFY_WAREHOUSE_NAME")

# ── Myntra ────────────────────────────────────────────────────────────────────

MYNTRA_ENABLED   = _bool("MYNTRA_ENABLED", False)
MYNTRA_API_URL   = _str("MYNTRA_API_URL")
MYNTRA_API_KEY   = _str("MYNTRA_API_KEY")
MYNTRA_WAREHOUSE = _str("MYNTRA_WAREHOUSE_NAME")

# ── Amazon ────────────────────────────────────────────────────────────────────

AMAZON_ENABLED        = _bool("AMAZON_ENABLED", False)
AMAZON_SELLER_ID      = _str("AMAZON_SELLER_ID")
AMAZON_ACCESS_KEY     = _str("AMAZON_ACCESS_KEY")
AMAZON_SECRET_KEY     = _str("AMAZON_SECRET_KEY")
AMAZON_MARKETPLACE_ID = _str("AMAZON_MARKETPLACE_ID")
AMAZON_WAREHOUSE      = _str("AMAZON_WAREHOUSE_NAME")


# ── Validation ────────────────────────────────────────────────────────────────

def validate():
    """
    Call before any setup runs.
    Raises EnvironmentError listing every missing variable.
    """
    missing = []

    required_always = {
        "COMPANY_NAME":     COMPANY_NAME,
        "COMPANY_ABBR":     COMPANY_ABBR,
        "COMPANY_CURRENCY": COMPANY_CURRENCY,
        "COMPANY_COUNTRY":  COMPANY_COUNTRY,
    }
    for key, val in required_always.items():
        if not val:
            missing.append(key)

    if CLOUDSTORE_ENABLED:
        for key, val in {
            "CLOUDSTORE_API_URL":   CLOUDSTORE_API_URL,
            "CLOUDSTORE_API_TOKEN": CLOUDSTORE_API_TOKEN,
        }.items():
            if not val:
                missing.append(f"{key}  (required because CLOUDSTORE_ENABLED=true)")

    if SHOPIFY_ENABLED:
        for key, val in {
            "SHOPIFY_SHOP_URL":     SHOPIFY_SHOP_URL,
            "SHOPIFY_ACCESS_TOKEN": SHOPIFY_ACCESS_TOKEN,
        }.items():
            if not val:
                missing.append(f"{key}  (required because SHOPIFY_ENABLED=true)")

    if MYNTRA_ENABLED:
        for key, val in {
            "MYNTRA_API_URL": MYNTRA_API_URL,
            "MYNTRA_API_KEY": MYNTRA_API_KEY,
        }.items():
            if not val:
                missing.append(f"{key}  (required because MYNTRA_ENABLED=true)")

    if AMAZON_ENABLED:
        for key, val in {
            "AMAZON_SELLER_ID":      AMAZON_SELLER_ID,
            "AMAZON_ACCESS_KEY":     AMAZON_ACCESS_KEY,
            "AMAZON_SECRET_KEY":     AMAZON_SECRET_KEY,
            "AMAZON_MARKETPLACE_ID": AMAZON_MARKETPLACE_ID,
        }.items():
            if not val:
                missing.append(f"{key}  (required because AMAZON_ENABLED=true)")

    if missing:
        lines = "\n  - ".join(missing)
        raise EnvironmentError(
            f"\n\nAlaiyOS install aborted — missing required .env variables:\n\n"
            f"  - {lines}\n\n"
            f"Edit alaiy_os_core/.env and re-run the install.\n"
        )
