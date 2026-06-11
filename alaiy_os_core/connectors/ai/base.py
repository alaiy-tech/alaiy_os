from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ChatMessage:
	role: str  # "system" | "user" | "assistant"
	content: str


@dataclass
class CompletionResult:
	text: str
	model: str
	input_tokens: int
	output_tokens: int
	raw: dict = field(default_factory=dict)


class IAIConnector(ABC):
	"""
	Abstract base for LLM provider connectors.

	Implementations: ClaudeConnector, OpenAIConnector, GeminiConnector.
	Active provider is resolved from Alaiy OS Settings.ai_provider.
	"""

	def __init__(self, settings) -> None:
		self.settings = settings

	@abstractmethod
	def complete(self, prompt: str, system: str | None = None, max_tokens: int = 1024) -> CompletionResult:
		"""Single-turn completion."""
		...

	@abstractmethod
	def chat(self, messages: list[ChatMessage], system: str | None = None, max_tokens: int = 2048) -> CompletionResult:
		"""Multi-turn chat completion."""
		...

	@abstractmethod
	def embed(self, text: str) -> list[float]:
		"""Return a text embedding vector (for semantic search / Ask Alaiy)."""
		...
