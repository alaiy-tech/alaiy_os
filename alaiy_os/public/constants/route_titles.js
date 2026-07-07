/**
 * AlaiyOS — Route-to-Section Title Mappings
 *
 * Loaded via app_include_js before alaiy_ui.js and route_guard.js.
 * Sections match the new sidebar structure in workspace_config.js.
 *
 * ALAIY_ROUTE_TITLES        — exact frappe.get_route_str() → section label
 * ALAIY_ROUTE_PREFIX_TITLES — prefix matches for Form/<DocType>/... routes
 */

// eslint-disable-next-line no-unused-vars
const ALAIY_ROUTE_TITLES = {
  "os": "Dashboard",

  // Inventory
  "List/Stock Entry/List":          "Inventory - Stock Entry",
  "List/Stock Reconciliation/List": "Inventory - Stock Reconciliation",
  "List/Purchase Receipt/List":     "Inventory - Purchase Receipt",

  // Catalog
  "List/Item/List":            "Catalog - Products",
  "List/Item Group/List":      "Catalog - Item Group",
  "List/Item Attribute/List":  "Catalog - Item Attribute",
  "List/Brand/List":           "Catalog - Brand",

  // Sales
  "List/Sales Order/List":   "Sales - Sales Order",
  "List/Sales Invoice/List": "Sales - Sales Invoice",

  // Customers
  "List/Customer/List":       "Customers",
  "List/Customer Group/List": "Customers - Customer Group",
  "List/Address/List":        "Customers - Address",
  "List/Contact/List":        "Customers - Contact",
  "List/UTM Source/List":     "Customers - UTM Source",

  // Procurement
  "List/Purchase Order/List":   "Procurement - Purchase Order",
  "List/Purchase Invoice/List": "Procurement - Purchase Invoice",
  "List/Supplier/List":         "Procurement - Supplier",
  "List/Supplier Group/List":   "Procurement - Supplier Group",

  // Pricing
  "List/Item Price/List":   "Pricing - Item Price",
  "List/Price List/List":   "Pricing - Price List",
  "List/Pricing Rule/List": "Pricing - Pricing Rule",
};

// eslint-disable-next-line no-unused-vars
const ALAIY_ROUTE_PREFIX_TITLES = [
  { prefix: "Form/Stock Entry",          title: "Stock Entry" },
  { prefix: "Form/Stock Reconciliation", title: "Stock Reconciliation" },
  { prefix: "Form/Purchase Receipt",     title: "Purchase Receipt" },
  { prefix: "Form/Item",                 title: "Products" },
  { prefix: "Form/Item Group",           title: "Item Group" },
  { prefix: "Form/Item Attribute",       title: "Item Attribute" },
  { prefix: "Form/Brand",                title: "Brand" },
  { prefix: "Form/Sales Order",          title: "Sales Order" },
  { prefix: "Form/Sales Invoice",        title: "Sales Invoice" },
  { prefix: "Form/Customer Group",       title: "Customer Group" },
  { prefix: "Form/Customer",             title: "Customers" },
  { prefix: "Form/Address",              title: "Address" },
  { prefix: "Form/Contact",              title: "Contact" },
  { prefix: "Form/UTM Source",           title: "UTM Source" },
  { prefix: "Form/Purchase Order",       title: "Purchase Order" },
  { prefix: "Form/Purchase Invoice",     title: "Purchase Invoice" },
  { prefix: "Form/Supplier Group",       title: "Supplier Group" },
  { prefix: "Form/Supplier",             title: "Supplier" },
  { prefix: "Form/Item Price",           title: "Item Price" },
  { prefix: "Form/Price List",           title: "Price List" },
  { prefix: "Form/Pricing Rule",         title: "Pricing Rule" },
];
