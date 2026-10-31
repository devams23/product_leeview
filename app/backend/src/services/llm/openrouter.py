import httpx
from typing import Any, Optional

from config import get_settings
from services.llm.base import LLMProvider

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
        self.timeout = httpx.Timeout(30.0, connect=10.0)

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

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"].get("content") or ""
