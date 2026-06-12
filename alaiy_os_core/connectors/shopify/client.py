"""
Shopify GraphQL Admin API transport.

Pure Python — no frappe imports. Callers read credentials from Alaiy OS Settings
and pass them explicitly. All errors surface as ShopifyAPIError.

Rate limiting: Shopify uses a cost-based leaky bucket. After every response we
check the `extensions.cost` block and sleep when available points are low.
"""

import time
import requests
from typing import Any

from .constants import API_VERSION, RATE_LIMIT_MIN_REMAINING, RATE_LIMIT_RESTORE_SLEEP


class ShopifyAPIError(Exception):
    def __init__(self, message: str, errors: list | None = None):
        self.errors = errors or []
        super().__init__(message)


class ShopifyUserError(ShopifyAPIError):
    """Raised when a mutation returns non-empty userErrors."""


class ShopifyClient:
    def __init__(self, shop_url: str, access_token: str, timeout: int = 30):
        if not shop_url:
            raise ValueError("Shopify shop URL is required")
        if not access_token:
            raise ValueError("Shopify access token is required")

        # Normalise: strip scheme and trailing slash, add .myshopify.com if bare
        shop_url = shop_url.strip().rstrip("/")
        if shop_url.startswith("https://") or shop_url.startswith("http://"):
            shop_url = shop_url.split("//", 1)[1]

        self._shop = shop_url
        self._timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        })

    @property
    def _graphql_url(self) -> str:
        return f"https://{self._shop}/admin/api/{API_VERSION}/graphql.json"

    # ------------------------------------------------------------------ #
    # Core transport                                                        #
    # ------------------------------------------------------------------ #

    def execute(self, query: str, variables: dict | None = None) -> dict:
        """
        Execute a GraphQL operation. Returns the `data` dict.
        Raises ShopifyAPIError on HTTP errors or top-level `errors`.
        Never raises on userErrors — callers must check those themselves.
        """
        payload: dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        resp = self._session.post(self._graphql_url, json=payload, timeout=self._timeout)

        if resp.status_code == 429:
            time.sleep(RATE_LIMIT_RESTORE_SLEEP)
            raise ShopifyAPIError("Rate limited — retry after sleep")

        if not resp.ok:
            raise ShopifyAPIError(
                f"Shopify GraphQL HTTP {resp.status_code}: {resp.text[:500]}"
            )

        body = resp.json()

        if "errors" in body:
            messages = [e.get("message", str(e)) for e in body["errors"]]
            raise ShopifyAPIError("; ".join(messages), errors=body["errors"])

        self._maybe_throttle(body)
        return body.get("data", {})

    def _maybe_throttle(self, body: dict) -> None:
        cost = body.get("extensions", {}).get("cost", {})
        throttle = cost.get("throttleStatus", {})
        available = throttle.get("currentlyAvailable", 9999)
        if available < RATE_LIMIT_MIN_REMAINING:
            restore_rate = throttle.get("restoreRate", 50)
            needed = RATE_LIMIT_MIN_REMAINING - available
            sleep_time = max(RATE_LIMIT_RESTORE_SLEEP, needed / max(restore_rate, 1))
            time.sleep(sleep_time)

    # ------------------------------------------------------------------ #
    # Convenience: execute + assert no userErrors                          #
    # ------------------------------------------------------------------ #

    def mutate(self, query: str, variables: dict | None = None, user_errors_path: list[str] | None = None) -> dict:
        """
        Execute a mutation and raise ShopifyUserError if userErrors is non-empty.
        user_errors_path: list of keys to navigate from data root to userErrors list.
        """
        data = self.execute(query, variables)
        if user_errors_path:
            node = data
            for key in user_errors_path:
                node = node.get(key, {}) if isinstance(node, dict) else {}
            errors = node if isinstance(node, list) else []
            if errors:
                messages = [e.get("message", str(e)) for e in errors]
                raise ShopifyUserError("; ".join(messages), errors=errors)
        return data

    # ------------------------------------------------------------------ #
    # Health check                                                          #
    # ------------------------------------------------------------------ #

    def health_check(self) -> dict:
        """
        Lightweight check using the shop query.
        Returns {"ok": True} or {"ok": False, "error": "..."}.
        Never raises.
        """
        try:
            data = self.execute("{ shop { name } }")
            name = data.get("shop", {}).get("name", "")
            return {"ok": True, "shop": name}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": str(e)}
