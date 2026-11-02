import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Optional

import httpx

from services.llm.structured import (
    MAX_ATTEMPTS,
    STRUCTURED_MAX_TOKENS,
    StructuredOutputError,
    correction,
    extract_json,
    schema_errors,
    with_json_instructions,
)

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    # Cleared the first time the model rejects response_format, so later calls skip the failed request.
    supports_response_format = True
    # Attempts made by the most recent generate_structured call.
    last_attempts = 0
    timeout = httpx.Timeout(20.0, connect=5.0)

    def _http(self) -> httpx.AsyncClient:
        """One HTTP client per provider instance, created on first use so its connection pool is reused."""
        client = getattr(self, "_client", None)
        if client is None:
            client = httpx.AsyncClient(timeout=self.timeout)
            self._client = client
        return client

    async def aclose(self) -> None:
        """Close the HTTP client if one was opened."""
        client = getattr(self, "_client", None)
        if client is not None:
            await client.aclose()
            self._client = None

    def record_usage(self, usage: Optional[dict[str, Any]]) -> None:
        """Add one completed request's token counts. Providers call this with the response's usage block."""
        usage = usage or {}
        self._in_tokens = getattr(self, "_in_tokens", 0) + int(usage.get("prompt_tokens") or 0)
        self._out_tokens = getattr(self, "_out_tokens", 0) + int(usage.get("completion_tokens") or 0)
        self._calls = getattr(self, "_calls", 0) + 1

    def usage_snapshot(self) -> tuple[int, int, int]:
        """Running totals as (input tokens, output tokens, requests)."""
        return getattr(self, "_in_tokens", 0), getattr(self, "_out_tokens", 0), getattr(self, "_calls", 0)

    @abstractmethod
    async def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        response_format: Optional[dict[str, Any]] = None,
        max_tokens: int = 1024,
    ) -> str:
        """Generate a chat completion response."""
        pass

    async def stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.6,
        max_tokens: int = 400,
    ) -> AsyncIterator[str]:
        """Yield the reply in pieces. Providers without streaming yield the whole reply once."""
        yield await self.generate(messages, temperature=temperature, max_tokens=max_tokens)

    async def _generate_json(
        self, messages: list[dict[str, str]], json_schema: dict[str, Any], temperature: float
    ) -> str:
        if self.supports_response_format:
            response_format = {"type": "json_schema", "json_schema": {"name": "reply", "schema": json_schema}}
            try:
                return await self.generate(
                    messages, temperature, response_format=response_format, max_tokens=STRUCTURED_MAX_TOKENS
                )
            except httpx.HTTPStatusError as e:
                if e.response.status_code not in (400, 422):
                    raise
                logger.warning("%s rejected response_format, relying on the prompt: %s", self.provider_name, e)
                self.supports_response_format = False
        return await self.generate(messages, temperature, max_tokens=STRUCTURED_MAX_TOKENS)

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        json_schema: dict[str, Any],
        temperature: float = 0.5,
        max_attempts: int = MAX_ATTEMPTS,
    ) -> dict[str, Any]:
        """Generate a response that conforms to a JSON schema."""
        attempt_messages = with_json_instructions(messages, json_schema)
        problem = "no attempt was made"

        for attempt in range(1, max_attempts + 1):
            self.last_attempts = attempt
            try:
                reply = await self._generate_json(attempt_messages, json_schema, temperature)
            except httpx.TransportError as e:
                problem = f"{type(e).__name__}: {e}"
            except httpx.HTTPStatusError as e:
                if e.response.status_code != 429 and e.response.status_code < 500:
                    raise
                problem = str(e)
            else:
                try:
                    parsed = extract_json(reply)
                    errors = schema_errors(parsed, json_schema)
                except ValueError as e:
                    errors = [str(e)]
                if not errors:
                    return parsed
                problem = "; ".join(errors)
                attempt_messages = attempt_messages + correction(reply, problem)
                logger.warning(
                    "%s structured attempt %d/%d rejected (%s): %.300r",
                    self.provider_name, attempt, max_attempts, problem, reply,
                )
                continue

            logger.warning("%s structured attempt %d/%d failed: %s", self.provider_name, attempt, max_attempts, problem)
            if attempt < max_attempts:
                await asyncio.sleep(0.5 * attempt)

        raise StructuredOutputError(problem)

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name for logging/debugging."""
        pass
