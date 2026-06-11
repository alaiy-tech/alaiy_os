from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class SourceProduct:
	supplier_sku: str
	title: str
	description: str
	price: float
	currency: str
	available_quantity: int
	images: list[str] = field(default_factory=list)
	attributes: dict = field(default_factory=dict)
	raw: dict = field(default_factory=dict)


@dataclass
class SourceASN:
	"""Advance Shipment Notice — inbound stock from supplier."""
	asn_id: str
	supplier: str
	items: list[dict]
	expected_arrival: str | None
	raw: dict = field(default_factory=dict)


class ISourceConnector(ABC):
	"""
	Abstract base for supplier / product source connectors.

	Implementations: TheCornerConnector, CSVSupplierConnector, APISupplierConnector.
	"""

	def __init__(self, settings) -> None:
		self.settings = settings

	@abstractmethod
	def get_catalog(self, since: str | None = None) -> list[SourceProduct]:
		"""Pull available product catalog from the supplier."""
		...

	@abstractmethod
	def get_inventory(self) -> dict[str, int]:
		"""Return current available quantities: {supplier_sku: qty}."""
		...

	@abstractmethod
	def place_po(self, items: list[dict]) -> str:
		"""Place a purchase order with the supplier. Returns PO reference ID."""
		...

	@abstractmethod
	def get_asn(self, po_reference: str) -> SourceASN | None:
		"""Fetch advance shipment notice for a given PO."""
		...
