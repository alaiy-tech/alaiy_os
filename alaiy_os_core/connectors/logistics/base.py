from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ShipmentRate:
	carrier: str
	service: str
	rate: float
	currency: str
	estimated_days: int


@dataclass
class Shipment:
	tracking_number: str
	carrier: str
	label_url: str | None
	raw: dict = field(default_factory=dict)


class ILogisticsConnector(ABC):
	"""
	Abstract base for last-mile logistics connectors.

	Implementations: FedExConnector, ShiprocketConnector, ManualConnector.
	"""

	def __init__(self, settings) -> None:
		self.settings = settings

	@abstractmethod
	def get_rates(self, origin: dict, destination: dict, parcels: list[dict]) -> list[ShipmentRate]:
		"""Get shipping rate options for a shipment."""
		...

	@abstractmethod
	def create_shipment(
		self,
		sales_order_id: str,
		origin: dict,
		destination: dict,
		parcels: list[dict],
		service: str | None = None,
	) -> Shipment:
		"""Book a shipment and return tracking info + label URL."""
		...

	@abstractmethod
	def track(self, tracking_number: str) -> dict:
		"""Return current tracking status for a shipment."""
		...

	@abstractmethod
	def void_shipment(self, tracking_number: str) -> bool:
		"""Cancel / void a booked shipment. Returns True on success."""
		...
