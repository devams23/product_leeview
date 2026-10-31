import re
import httpx
from typing import Any, Optional

from config import get_settings
from services.llm.base import LLMProvider

settings = get_settings()


class NVIDIANIMProvider(LLMProvider):
    """NVIDIA NIM LLM provider implementation."""

    def __init__(self):
        self.api_key = settings.nvidia_nim_api_key
        self.base_url = settings.nvidia_nim_base_url
        self.model = settings.nvidia_nim_model
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        self.timeout = httpx.Timeout(30.0, connect=10.0)

    @property
    def provider_name(self) -> str:
        return "nvidia_nim"

    async def generate(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        response_format: Optional[dict[str, Any]] = None,
        max_tokens: int = 1024,
    ) -> str:
        """Send a chat completion request to NVIDIA NIM."""
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
            if response.is_error:
                # Name the model and keep NVIDIA's message: a bare "410 Gone" hides that the model was retired.
                raise httpx.HTTPStatusError(
                    f"NVIDIA NIM {response.status_code} for model '{self.model}': {response.text[:300]}",
                    request=response.request,
                    response=response,
                )
            data = response.json()
            content = data["choices"][0]["message"].get("content") or ""
            # Reasoning models prepend their thinking; the interviewer must only say the answer.
            return re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
