from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class StockPosition:
	warehouse: str
	item_code: str
	actual_qty: float
	reserved_qty: float
	available_qty: float


@dataclass
class DispatchResult:
	success: bool
	reference: str
	raw: dict = field(default_factory=dict)


class IWarehouseConnector(ABC):
	"""
	Abstract base for warehouse / WMS connectors.

	Implementations: InternalWarehouseConnector (ERPNext-native), GlobaliWMSConnector.
	"""

	def __init__(self, settings) -> None:
		self.settings = settings

	@abstractmethod
	def query_stock(self, item_codes: list[str], warehouse: str | None = None) -> list[StockPosition]:
		"""Return current stock positions for given items."""
		...

	@abstractmethod
	def create_asn(self, purchase_receipt_id: str, items: list[dict]) -> str:
		"""Register an inbound ASN at the warehouse. Returns WMS reference ID."""
		...

	@abstractmethod
	def dispatch(self, delivery_note_id: str, items: list[dict]) -> DispatchResult:
		"""Trigger dispatch / pick-pack-ship for an outbound order."""
		...

	@abstractmethod
	def receive_return(self, return_id: str, items: list[dict]) -> bool:
		"""Accept a customer return back into warehouse stock."""
		...
