"""
Shopify GraphQL Admin API constants.
"""

API_VERSION = "2026-04"

# GID prefixes
GID_PRODUCT = "gid://shopify/Product/"
GID_VARIANT = "gid://shopify/ProductVariant/"
GID_LOCATION = "gid://shopify/Location/"
GID_COLLECTION = "gid://shopify/Collection/"
GID_METAFIELD = "gid://shopify/Metafield/"
GID_INVENTORY_ITEM = "gid://shopify/InventoryItem/"
GID_INVENTORY_LEVEL = "gid://shopify/InventoryLevel/"

# Rate limit — conservative point budget to stay below leaky-bucket ceiling
RATE_LIMIT_MIN_REMAINING = 100  # pause when available points drop below this
RATE_LIMIT_RESTORE_SLEEP = 2.0  # seconds to sleep when throttled

# Shopify max items per bulk operation page
PAGE_SIZE = 50

# Product status values
STATUS_ACTIVE = "ACTIVE"
STATUS_DRAFT = "DRAFT"
STATUS_ARCHIVED = "ARCHIVED"

# Weight units
WEIGHT_UNIT_KG = "KILOGRAMS"
WEIGHT_UNIT_G = "GRAMS"

# Metafield namespaces used by Alaiy OS
METAFIELD_NAMESPACE = "alaiy_os"
