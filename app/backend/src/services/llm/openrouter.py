import httpx
from typing import Any, AsyncIterator, Optional

from config import get_settings
from services.llm.base import LLMProvider
from services.llm.streaming import parse_sse_line

settings = get_settings()


class OpenRouterProvider(LLMProvider):
    """OpenRouter LLM provider implementation (OpenAI-compatible API)."""

    def __init__(self):
        self.api_key = settings.openrouter_api_key
        self.base_url = settings.openrouter_base_url
        self.model = settings.openrouter_model
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://leeview.app",
            "X-Title": "LeeView Mock Interview",
        }
    @property
    def provider_name(self) -> str:
        return "openrouter"

    async def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        response_format: Optional[dict[str, Any]] = None,
        max_tokens: int = 1024,
    ) -> str:
        """Send a chat completion request to OpenRouter."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        response = await self._http().post(
            f"{self.base_url}/chat/completions",
            headers=self.headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        self.record_usage(data.get("usage"))
        return data["choices"][0]["message"].get("content") or ""

    async def stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.6,
        max_tokens: int = 400,
    ) -> AsyncIterator[str]:
        """Yield reply text as OpenRouter streams it."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        async with self._http().stream(
            "POST", f"{self.base_url}/chat/completions", headers=self.headers, json=payload
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                event = parse_sse_line(line)
                if event is None:
                    continue
                if event.get("usage"):
                    self.record_usage(event["usage"])
                choices = event.get("choices") or []
                content = (choices[0].get("delta") or {}).get("content") if choices else None
                if content:
                    yield content
