"""
ConnectorRegistry — resolves the active connector implementation for each
connector family from the per-instance Alaiy OS Settings single DocType.

Usage:
    from alaiy_os_core.connectors.registry import ConnectorRegistry

    channel = ConnectorRegistry.get_channel()          # primary channel
    channel = ConnectorRegistry.get_channel("Myntra")  # explicit channel
    logistics = ConnectorRegistry.get_logistics()
    ai = ConnectorRegistry.get_ai()
"""

from __future__ import annotations

import importlib

import frappe

from alaiy_os_core.connectors.ai.base import IAIConnector
from alaiy_os_core.connectors.channel.base import IChannelConnector
from alaiy_os_core.connectors.logistics.base import ILogisticsConnector
from alaiy_os_core.connectors.oms.base import IOmsConnector
from alaiy_os_core.connectors.source.base import ISourceConnector
from alaiy_os_core.connectors.warehouse.base import IWarehouseConnector

# --- Implementation registry maps ----------------------------------------
# Add the dotted path to each new implementation here as it's built.

_CHANNEL: dict[str, str] = {
	"Shopify": "alaiy_os_core.connectors.channel.shopify.ShopifyConnector",
	"Myntra": "alaiy_os_core.connectors.channel.myntra.MyntraConnector",
	"Amazon": "alaiy_os_core.connectors.channel.amazon.AmazonConnector",
	"Flipkart": "alaiy_os_core.connectors.channel.flipkart.FlipkartConnector",
	"Nykaa": "alaiy_os_core.connectors.channel.nykaa.NykaaConnector",
}

_LOGISTICS: dict[str, str] = {
	"FedEx": "alaiy_os_core.connectors.logistics.fedex.FedExConnector",
	"Shiprocket": "alaiy_os_core.connectors.logistics.shiprocket.ShiprocketConnector",
	"Manual": "alaiy_os_core.connectors.logistics.manual.ManualConnector",
}

_WAREHOUSE: dict[str, str] = {
	"ERPNext Internal": "alaiy_os_core.connectors.warehouse.internal.InternalWarehouseConnector",
	"Globali WMS": "alaiy_os_core.connectors.warehouse.globali_wms.GlobaliWMSConnector",
}

_OMS: dict[str, str] = {
	"OMS Guru": "alaiy_os_core.connectors.oms.oms_guru.OMSGuruConnector",
	"Gobase": "alaiy_os_core.connectors.oms.gobase.GobaseConnector",
}

_AI: dict[str, str] = {
	"Claude": "alaiy_os_core.connectors.ai.claude.ClaudeConnector",
	"OpenAI": "alaiy_os_core.connectors.ai.openai.OpenAIConnector",
	"Gemini": "alaiy_os_core.connectors.ai.gemini.GeminiConnector",
}

_SOURCE: dict[str, str] = {
	"The Corner": "alaiy_os_core.connectors.source.the_corner.TheCornerConnector",
	"CSV": "alaiy_os_core.connectors.source.csv_supplier.CSVSupplierConnector",
	"API": "alaiy_os_core.connectors.source.api_supplier.APISupplierConnector",
}


# -------------------------------------------------------------------------


def _load(dotted_path: str, settings):
	"""Import a class by dotted path and instantiate it with settings."""
	module_path, class_name = dotted_path.rsplit(".", 1)
	module = importlib.import_module(module_path)
	cls = getattr(module, class_name)
	return cls(settings)


class ConnectorRegistry:
	"""Factory that resolves connector implementations from Alaiy OS Settings."""

	@staticmethod
	def _settings():
		return frappe.get_single("Alaiy OS Settings")

	@classmethod
	def get_channel(cls, channel: str | None = None) -> IChannelConnector:
		s = cls._settings()
		key = channel or s.primary_channel
		if key not in _CHANNEL:
			frappe.throw(f"No channel connector registered for '{key}'")
		return _load(_CHANNEL[key], s)

	@classmethod
	def get_logistics(cls) -> ILogisticsConnector:
		s = cls._settings()
		key = s.logistics_provider
		if key not in _LOGISTICS:
			frappe.throw(f"No logistics connector registered for '{key}'")
		return _load(_LOGISTICS[key], s)

	@classmethod
	def get_warehouse(cls) -> IWarehouseConnector:
		s = cls._settings()
		key = s.warehouse_provider
		if key not in _WAREHOUSE:
			frappe.throw(f"No warehouse connector registered for '{key}'")
		return _load(_WAREHOUSE[key], s)

	@classmethod
	def get_oms(cls) -> IOmsConnector:
		s = cls._settings()
		key = s.oms_provider
		if not key or key not in _OMS:
			frappe.throw(f"No OMS connector registered for '{key}'")
		return _load(_OMS[key], s)

	@classmethod
	def get_ai(cls) -> IAIConnector:
		s = cls._settings()
		key = s.ai_provider
		if key not in _AI:
			frappe.throw(f"No AI connector registered for '{key}'")
		return _load(_AI[key], s)

	@classmethod
	def get_source(cls, source: str | None = None) -> ISourceConnector:
		s = cls._settings()
		key = source or s.source_provider
		if key not in _SOURCE:
			frappe.throw(f"No source connector registered for '{key}'")
		return _load(_SOURCE[key], s)
