from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ChannelOrder:
	channel_order_id: str
	channel: str
	customer_name: str
	customer_email: str
	items: list[dict]
	total: float
	currency: str
	status: str
	created_at: str
	raw: dict = field(default_factory=dict)


@dataclass
class ChannelProduct:
	channel_product_id: str
	channel: str
	title: str
	sku: str
	price: float
	inventory_quantity: int
	raw: dict = field(default_factory=dict)


@dataclass
class ChannelReturn:
	channel_return_id: str
	channel_order_id: str
	channel: str
	reason: str
	status: str
	items: list[dict]
	raw: dict = field(default_factory=dict)


class IChannelConnector(ABC):
	"""
	Abstract base for all sales channel connectors.

	Implementations: ShopifyConnector, MyntraConnector, AmazonConnector, etc.
	Resolved at runtime by ConnectorRegistry from Alaiy OS Settings.
	"""

	def __init__(self, settings) -> None:
		self.settings = settings

	# --- Orders ---

	@abstractmethod
	def get_orders(self, since: str | None = None, status: str = "unfulfilled") -> list[ChannelOrder]:
		"""Pull open orders from the channel since an ISO timestamp."""
		...

	@abstractmethod
	def get_order(self, channel_order_id: str) -> ChannelOrder:
		"""Fetch a single order by its channel-native ID."""
		...

	@abstractmethod
	def fulfill_order(self, channel_order_id: str, tracking_number: str, carrier: str) -> bool:
		"""Mark an order as fulfilled. Returns True on success."""
		...

	@abstractmethod
	def cancel_order(self, channel_order_id: str, reason: str = "") -> bool:
		"""Cancel an order on the channel."""
		...

	# --- Products ---

	@abstractmethod
	def get_products(self, since: str | None = None) -> list[ChannelProduct]:
		"""Pull product catalog from the channel."""
		...

	@abstractmethod
	def push_product(self, item_code: str) -> str:
		"""Publish an ERPNext Item to the channel. Returns the channel product ID."""
		...

	@abstractmethod
	def update_inventory(self, sku_map: dict[str, int]) -> bool:
		"""Push stock levels to the channel. sku_map: {sku: quantity}."""
		...

	# --- Returns ---

	@abstractmethod
	def get_returns(self, since: str | None = None) -> list[ChannelReturn]:
		"""Pull return / refund requests from the channel."""
		...
