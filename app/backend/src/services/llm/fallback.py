import asyncio
import logging
import time
from typing import Any, AsyncIterator, Optional, Sequence

from services.llm.base import LLMProvider
from services.llm.structured import MAX_ATTEMPTS

logger = logging.getLogger(__name__)

# After a provider fails, the others are tried first for this long.
COOLDOWN_S = 60.0


class FallbackLLMProvider(LLMProvider):
    """Tries providers in order (NVIDIA NIM, then OpenRouter) and moves on when one fails.

    A failed provider is tried last for COOLDOWN_S, so a session does not pay for the same
    timeout on every turn. A stream that fails after it has yielded text is not retried
    elsewhere: the candidate has already heard half a sentence, so the caller handles it.
    """

    def __init__(self, providers: Sequence[LLMProvider]):
        if not providers:
            raise ValueError("FallbackLLMProvider needs at least one provider")
        self.providers = list(providers)
        self._down_until: dict[int, float] = {}
        self.last_attempts = 0
        # Name of the provider that answered the most recent call, for logs and metrics.
        self.last_provider: Optional[str] = None

    @property
    def provider_name(self) -> str:
        return "+".join(p.provider_name for p in self.providers)

    def _order(self) -> list[LLMProvider]:
        now = time.monotonic()
        healthy = [p for i, p in enumerate(self.providers) if self._down_until.get(i, 0) <= now]
        cooling = [p for i, p in enumerate(self.providers) if self._down_until.get(i, 0) > now]
        return healthy + cooling

    def _mark_down(self, provider: LLMProvider, error: BaseException) -> None:
        index = self.providers.index(provider)
        self._down_until[index] = time.monotonic() + COOLDOWN_S
        logger.warning("LLM provider %s failed, falling back: %s", provider.provider_name, error)

    def _mark_up(self, provider: LLMProvider) -> None:
        self._down_until.pop(self.providers.index(provider), None)
        self.last_provider = provider.provider_name

    async def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        response_format: Optional[dict[str, Any]] = None,
        max_tokens: int = 1024,
    ) -> str:
        error: Optional[BaseException] = None
        self.last_attempts = 0
        for provider in self._order():
            self.last_attempts += 1
            try:
                reply = await provider.generate(
                    messages, temperature, response_format=response_format, max_tokens=max_tokens
                )
            except asyncio.CancelledError:
                raise
            except Exception as e:
                self._mark_down(provider, e)
                error = e
                continue
            self._mark_up(provider)
            return reply
        raise error  # type: ignore[misc]

    async def stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.6,
        max_tokens: int = 400,
    ) -> AsyncIterator[str]:
        error: Optional[BaseException] = None
        self.last_attempts = 0
        for provider in self._order():
            self.last_attempts += 1
            started = False
            try:
                async for piece in provider.stream(messages, temperature=temperature, max_tokens=max_tokens):
                    started = True
                    yield piece
            except asyncio.CancelledError:
                raise
            except Exception as e:
                self._mark_down(provider, e)
                if started:
                    raise
                error = e
                continue
            self._mark_up(provider)
            return
        raise error  # type: ignore[misc]

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        json_schema: dict[str, Any],
        temperature: float = 0.5,
        max_attempts: int = MAX_ATTEMPTS,
    ) -> dict[str, Any]:
        error: Optional[BaseException] = None
        attempts = 0
        try:
            for provider in self._order():
                try:
                    result = await provider.generate_structured(
                        messages, json_schema, temperature=temperature, max_attempts=max_attempts
                    )
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    attempts += provider.last_attempts or 1
                    self._mark_down(provider, e)
                    error = e
                    continue
                attempts += provider.last_attempts or 1
                self._mark_up(provider)
                return result
        finally:
            self.last_attempts = attempts
        raise error  # type: ignore[misc]

    def usage_snapshot(self) -> tuple[int, int, int]:
        totals = [p.usage_snapshot() for p in self.providers]
        return tuple(sum(t[i] for t in totals) for i in range(3))  # type: ignore[return-value]

    async def aclose(self) -> None:
        for provider in self.providers:
            try:
                await provider.aclose()
            except Exception as e:
                logger.warning("Could not close %s: %s", provider.provider_name, e)
