"""
Connector config loader — reads from config/env.py which reads from .env.
"""

from alaiy_os_core.config import env


def is_connector_enabled(connector_name: str) -> bool:
    mapping = {
        "cloudstore": env.CLOUDSTORE_ENABLED,
        "shopify":    env.SHOPIFY_ENABLED,
        "myntra":     env.MYNTRA_ENABLED,
        "amazon":     env.AMAZON_ENABLED,
    }
    return mapping.get(connector_name, False)


def get_connector_settings(connector_name: str) -> dict:
    if connector_name == "cloudstore":
        return {
            "enabled":             env.CLOUDSTORE_ENABLED,
            "api_url":             env.CLOUDSTORE_API_URL,
            "api_token":           env.CLOUDSTORE_API_TOKEN,
            "supplier_name":       env.CLOUDSTORE_SUPPLIER_NAME,
            "supplier_country":    env.CLOUDSTORE_SUPPLIER_COUNTRY,
            "price_list_name":     env.CLOUDSTORE_PRICE_LIST_NAME,
            "price_list_currency": env.CLOUDSTORE_PRICE_LIST_CCY,
            "warehouse_name":      env.CLOUDSTORE_WAREHOUSE_NAME,
            "page_size":           env.CLOUDSTORE_PAGE_SIZE,
        }
    if connector_name == "shopify":
        return {
            "enabled":        env.SHOPIFY_ENABLED,
            "shop_url":       env.SHOPIFY_SHOP_URL,
            "access_token":   env.SHOPIFY_ACCESS_TOKEN,
            "warehouse_name": env.SHOPIFY_WAREHOUSE,
        }
    if connector_name == "myntra":
        return {
            "enabled":        env.MYNTRA_ENABLED,
            "api_url":        env.MYNTRA_API_URL,
            "api_key":        env.MYNTRA_API_KEY,
            "warehouse_name": env.MYNTRA_WAREHOUSE,
        }
    if connector_name == "amazon":
        return {
            "enabled":        env.AMAZON_ENABLED,
            "seller_id":      env.AMAZON_SELLER_ID,
            "access_key":     env.AMAZON_ACCESS_KEY,
            "secret_key":     env.AMAZON_SECRET_KEY,
            "marketplace_id": env.AMAZON_MARKETPLACE_ID,
            "warehouse_name": env.AMAZON_WAREHOUSE,
        }
    return {}


def get_company_config() -> dict:
    return {
        "name":         env.COMPANY_NAME,
        "abbreviation": env.COMPANY_ABBR,
        "currency":     env.COMPANY_CURRENCY,
        "country":      env.COMPANY_COUNTRY,
    }
