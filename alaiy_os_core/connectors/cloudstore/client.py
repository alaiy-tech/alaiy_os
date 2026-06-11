"""
HTTP transport for the Cloudstore / The Corner API.

No frappe imports — this module is pure Python so it can be unit-tested
without a running bench. All errors surface as CloudstoreAPIError; callers
in the service layer are responsible for catching and logging via frappe.
"""

import requests
from typing import Any

from alaiy_os_core.config import env


class CloudstoreAPIError(Exception):
    def __init__(self, method: str, url: str, status_code: int, message: str):
        self.method = method
        self.url = url
        self.status_code = status_code
        super().__init__(f"Cloudstore {method} {url} → {status_code}: {message}")


class CloudstoreClient:
    def __init__(self, base_url: str | None = None, token: str | None = None, timeout: int = 30):
        """
        If base_url / token are passed explicitly, use them (useful in tests).
        Otherwise fall back to env vars — the normal production path.
        """
        self._base = (base_url or env.CLOUDSTORE_API_URL).rstrip("/")
        _token = token or env.CLOUDSTORE_API_TOKEN
        self._timeout = timeout

        if not self._base:
            raise ValueError("Cloudstore base URL not set — check CLOUDSTORE_API_URL in .env")
        if not _token:
            raise ValueError("Cloudstore API token not set — check CLOUDSTORE_API_TOKEN in .env")

        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        })

    # ------------------------------------------------------------------
    # Low-level HTTP helpers
    # ------------------------------------------------------------------

    def _get(self, path: str, params: dict | None = None) -> Any:
        url = f"{self._base}{path}"
        resp = self._session.get(url, params=params, timeout=self._timeout)
        if not resp.ok:
            raise CloudstoreAPIError("GET", url, resp.status_code, resp.text[:500])
        return resp.json()

    def _post(self, path: str, body: dict | None = None, params: dict | None = None) -> Any:
        url = f"{self._base}{path}"
        resp = self._session.post(url, json=body or {}, params=params, timeout=self._timeout)
        if not resp.ok:
            raise CloudstoreAPIError("POST", url, resp.status_code, resp.text[:500])
        return resp.json()

    # ------------------------------------------------------------------
    # Catalog endpoints
    # ------------------------------------------------------------------

    def get_categories(self) -> list[dict]:
        """Return the full category tree."""
        data = self._get("/categories")
        return data if isinstance(data, list) else data.get("data", [])

    def get_products(self, page: int = 1, page_size: int = 100, category_id: str | None = None) -> dict:
        """
        Return one page of products.

        Response shape: { "data": [...], "total": int, "page": int, "page_size": int }
        """
        params: dict = {"page": page, "page_size": page_size}
        if category_id:
            params["category_id"] = category_id
        return self._get("/products", params=params)

    def get_product(self, product_id: str) -> dict:
        """Return a single product by its Cloudstore _id.$oid."""
        return self._get(f"/products/{product_id}")

    def get_product_variants(self, product_id: str) -> list[dict]:
        """Return all variants (SKUs) for a product."""
        data = self._get(f"/products/{product_id}/variants")
        return data if isinstance(data, list) else data.get("data", [])

    def get_stock(self, sku_ids: list[str]) -> list[dict]:
        """
        Bulk stock query.  POST body: { "sku_ids": [...] }
        Returns list of { "sku_id": str, "quantity": int }
        """
        return self._post("/stock/query", body={"sku_ids": sku_ids})

    # ------------------------------------------------------------------
    # Event / incremental sync endpoints
    # ------------------------------------------------------------------

    def get_events(self, since_event_id: str | None = None, page_size: int = 200) -> dict:
        """
        Poll for stock/price/product change events.

        Returns: { "data": [...], "last_event_id": str }
        """
        params: dict = {"page_size": page_size}
        if since_event_id:
            params["since"] = since_event_id
        return self._get("/events", params=params)

    # ------------------------------------------------------------------
    # Order endpoints
    # ------------------------------------------------------------------

    def create_order(self, order_payload: dict) -> dict:
        """Push a purchase order to Cloudstore."""
        return self._post("/orders", body=order_payload)

    def get_order(self, order_id: str) -> dict:
        """Fetch a single order by Cloudstore order ID."""
        return self._get(f"/orders/{order_id}")

    def get_orders(self, page: int = 1, page_size: int = 50, status: str | None = None) -> dict:
        """Return a paginated list of orders."""
        params: dict = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        return self._get("/orders", params=params)

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    def health_check(self) -> dict:
        """
        Makes a real API call to verify credentials are valid.
        Returns {"ok": True} or {"ok": False, "error": "..."}
        Never raises — always returns a dict.
        """
        try:
            self._get("/shop/v1/categories/roots", params={"_pageIndex": 0, "_pageSize": 1})
            return {"ok": True}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
