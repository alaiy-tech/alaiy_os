"""
HTTP transport for the Cloudstore / The Corner API.

Pure Python — no frappe imports. Callers are responsible for reading
credentials from Alaiy OS Settings and passing them explicitly.
All errors surface as CloudstoreAPIError.
"""

import requests
from typing import Any


class CloudstoreAPIError(Exception):
    def __init__(self, method: str, url: str, status_code: int, message: str):
        self.method = method
        self.url = url
        self.status_code = status_code
        super().__init__(f"Cloudstore {method} {url} → {status_code}: {message}")


class CloudstoreClient:
    def __init__(self, base_url: str, token: str, timeout: int = 30):
        if not base_url:
            raise ValueError("Cloudstore API URL is required")
        if not token:
            raise ValueError("Cloudstore API token is required")

        self._base = base_url.rstrip("/")
        self._timeout = timeout

        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {token}",
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
        params: dict = {"page": page, "page_size": page_size}
        if category_id:
            params["category_id"] = category_id
        return self._get("/products", params=params)

    def get_product(self, product_id: str) -> dict:
        return self._get(f"/products/{product_id}")

    def get_product_variants(self, product_id: str) -> list[dict]:
        data = self._get(f"/products/{product_id}/variants")
        return data if isinstance(data, list) else data.get("data", [])

    def get_stock(self, sku_ids: list[str]) -> list[dict]:
        return self._post("/stock/query", body={"sku_ids": sku_ids})

    # ------------------------------------------------------------------
    # Event / incremental sync endpoints
    # ------------------------------------------------------------------

    def get_events(self, since_event_id: str | None = None, page_size: int = 200) -> dict:
        params: dict = {"page_size": page_size}
        if since_event_id:
            params["since"] = since_event_id
        return self._get("/events", params=params)

    # ------------------------------------------------------------------
    # Order endpoints
    # ------------------------------------------------------------------

    def create_order(self, order_payload: dict) -> dict:
        return self._post("/orders", body=order_payload)

    def get_order(self, order_id: str) -> dict:
        return self._get(f"/orders/{order_id}")

    def get_orders(self, page: int = 1, page_size: int = 50, status: str | None = None) -> dict:
        params: dict = {"page": page, "page_size": page_size}
        if status:
            params["status"] = status
        return self._get("/orders", params=params)

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    def health_check(self) -> dict:
        """
        Lightweight connectivity check using the categories endpoint.
        Returns {"ok": True} or {"ok": False, "error": "..."}.
        Never raises.
        """
        try:
            self._get("/categories", params={"page": 1, "page_size": 1})
            return {"ok": True}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
