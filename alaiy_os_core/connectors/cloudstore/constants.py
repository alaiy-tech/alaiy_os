DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 500

# Cloudstore product status values
STATUS_ACTIVE = "active"
STATUS_INACTIVE = "inactive"

# Cloudstore order status values
ORDER_STATUS_PENDING = "pending"
ORDER_STATUS_CONFIRMED = "confirmed"
ORDER_STATUS_SHIPPED = "shipped"
ORDER_STATUS_DELIVERED = "delivered"
ORDER_STATUS_CANCELLED = "cancelled"

# Cloudstore event types for incremental sync
EVENT_STOCK_UPDATE = "stock_update"
EVENT_PRICE_UPDATE = "price_update"
EVENT_PRODUCT_UPDATE = "product_update"

# ERPNext item type for products with variants
ITEM_TYPE_TEMPLATE = "Template"
ITEM_TYPE_VARIANT = "Variant"

# Custom field names added to ERPNext Item
CF_CLOUDSTORE_ID = "cloudstore_id"
CF_CLOUDSTORE_SKU = "cloudstore_sku"
CF_CLOUDSTORE_UPDATED_AT = "cloudstore_updated_at"

# Attribute names used when creating item variants
ATTR_COLOR = "Colour"
ATTR_SIZE = "Size"
