"""get_catalogue_health -- find products with missing/incomplete content."""

from typing import Any, Dict, List

import frappe

from alaiy_os.assistant_tools._base import AlaiyTool

_ALL_CHECKS = ("images", "description", "attributes", "price")

# Owned by alaiy_os_agent_shopify_listing (which defines the same constant as
# bulk.ENRICHED_DOCTYPE). Named, not imported — see _items_with_attributes().
_ENRICHED_DOCTYPE = "Shopify Enriched Listing"


class GetCatalogueHealth(AlaiyTool):
    def __init__(self):
        super().__init__()
        self.name = "get_catalogue_health"
        self.description = (
            "Identify products with missing or incomplete content. Checks any of: "
            "images (Item image), description, attributes (an enriched listing with "
            "extracted attributes), and price (a selling Item Price). Returns per-item "
            "gaps and an overall health score (0-1)."
        )
        self.inputSchema = {
            "type": "object",
            "properties": {
                "check": {
                    "type": "array",
                    "items": {"type": "string", "enum": list(_ALL_CHECKS) + ["all"]},
                    "description": "Which checks to run. Default ['all'].",
                },
                "item_codes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional item codes; omit for all sales items.",
                },
            },
            "required": [],
        }

    def run(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        checks = [c.lower() for c in self.as_list(arguments.get("check"))] or ["all"]
        if "all" in checks:
            checks = list(_ALL_CHECKS)
        checks = [c for c in checks if c in _ALL_CHECKS]

        item_codes = self.as_list(arguments.get("item_codes"))
        filters = {"is_sales_item": 1, "disabled": 0}
        if item_codes:
            filters = {"name": ["in", item_codes]}

        items = frappe.get_all(
            "Item", filters=filters, fields=["name", "item_name", "image", "description"], limit_page_length=0
        )
        names = [i["name"] for i in items]

        priced = self._items_with_price(names) if "price" in checks else set()
        attr_items = self._items_with_attributes(names) if "attributes" in checks else set()

        rows: List[Dict[str, Any]] = []
        total_checks = 0
        passed_checks = 0
        for it in items:
            gaps = []
            if "images" in checks and not it.get("image"):
                gaps.append("images")
            if "description" in checks and not (it.get("description") or "").strip():
                gaps.append("description")
            if "price" in checks and it["name"] not in priced:
                gaps.append("price")
            if "attributes" in checks and it["name"] not in attr_items:
                gaps.append("attributes")

            total_checks += len(checks)
            passed_checks += len(checks) - len(gaps)
            if gaps:
                rows.append({"item_code": it["name"], "item_name": it.get("item_name"), "gaps": gaps})

        score = round(passed_checks / total_checks, 3) if total_checks else 1.0
        return self.ok(
            checks=checks,
            items_evaluated=len(items),
            items_with_gaps=len(rows),
            health_score=score,
            items=rows,
        )

    @staticmethod
    def _items_with_price(names):
        if not names:
            return set()
        rows = frappe.get_all(
            "Item Price",
            filters={"item_code": ["in", names], "selling": 1},
            fields=["item_code"],
            distinct=True,
        )
        return {r["item_code"] for r in rows}

    @staticmethod
    def _items_with_attributes(names):
        """Items with a Shopify Enriched Listing carrying non-empty attributes_json.

        The DocType is owned by alaiy_os_agent_shopify_listing, so it is named
        here as a string and guarded rather than imported: core must not depend
        on an agent app, and a bench without that app simply scores no items on
        the attributes signal. (It was previously named "Enriched Listing",
        which exists nowhere, so this check silently contributed zero.)
        """
        if not names or not frappe.db.exists("DocType", _ENRICHED_DOCTYPE):
            return set()
        rows = frappe.get_all(
            _ENRICHED_DOCTYPE,
            filters={"item_code": ["in", names]},
            fields=["item_code", "attributes_json"],
        )
        out = set()
        for r in rows:
            val = (r.get("attributes_json") or "").strip()
            if val and val not in ("{}", "[]", "null"):
                out.add(r["item_code"])
        return out
