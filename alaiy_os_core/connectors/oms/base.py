from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class OMSOrder:
	oms_order_id: str
	channel: str
	status: str
	items: list[dict]
	raw: dict = field(default_factory=dict)


@dataclass
class OMSStockEntry:
	item_code: str
	warehouse: str
	qty: float
	raw: dict = field(default_factory=dict)


class IOmsConnector(ABC):
	"""
	Abstract base for external OMS bridge connectors.

	Used by Globali to read from OMS Guru / Gobase instead of ERPNext-native flows.
	Implementations: OMSGuruConnector, GobaseConnector.
	"""

	def __init__(self, settings) -> None:
		self.settings = settings

	@abstractmethod
	def pull_orders(self, since: str | None = None, status: str | None = None) -> list[OMSOrder]:
		"""Pull orders from the external OMS."""
		...

	@abstractmethod
	def pull_inventory(self) -> list[OMSStockEntry]:
		"""Pull current stock positions from the external OMS."""
		...

	@abstractmethod
	def pull_returns(self, since: str | None = None) -> list[dict]:
		"""Pull return / cancellation records from the external OMS."""
		...

	@abstractmethod
	def pull_grn(self, since: str | None = None) -> list[dict]:
		"""Pull Goods Receipt Notes (inbound stock) from the external OMS."""
		...
