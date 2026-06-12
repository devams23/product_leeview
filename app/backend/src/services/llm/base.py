from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate(
        self, messages: list[dict[str, str]], temperature: float = 0.7
    ) -> str:
        """Generate a chat completion response."""
        pass

    @abstractmethod
    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        json_schema: dict[str, Any],
        temperature: float = 0.5,
    ) -> dict[str, Any]:
        """Generate a structured response conforming to a JSON schema."""
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name for logging/debugging."""
        pass
