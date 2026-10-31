import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, Optional

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
    ) -> dict[str, Any]:
        """Generate a response that conforms to a JSON schema."""
        attempt_messages = with_json_instructions(messages, json_schema)
        problem = "no attempt was made"

        for attempt in range(1, MAX_ATTEMPTS + 1):
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
                    self.provider_name, attempt, MAX_ATTEMPTS, problem, reply,
                )
                continue

            logger.warning("%s structured attempt %d/%d failed: %s", self.provider_name, attempt, MAX_ATTEMPTS, problem)
            if attempt < MAX_ATTEMPTS:
                await asyncio.sleep(attempt)

        raise StructuredOutputError(problem)

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name for logging/debugging."""
        pass
