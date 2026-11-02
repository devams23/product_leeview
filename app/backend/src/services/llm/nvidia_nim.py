import re
import httpx
from typing import Any, AsyncIterator, Optional

from config import get_settings
from services.llm.base import LLMProvider
from services.llm.streaming import ThinkFilter, parse_sse_line

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

        response = await self._http().post(
            f"{self.base_url}/chat/completions",
            headers=self.headers,
            json=payload,
        )
        if response.is_error:
            raise self._status_error(response)
        data = response.json()
        self.record_usage(data.get("usage"))
        content = data["choices"][0]["message"].get("content") or ""
        # Reasoning models prepend their thinking; the interviewer must only say the answer.
        return re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

    async def stream(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.6,
        max_tokens: int = 400,
    ) -> AsyncIterator[str]:
        """Yield reply text as NIM streams it, with reasoning blocks removed."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        think = ThinkFilter()
        async with self._http().stream(
            "POST", f"{self.base_url}/chat/completions", headers=self.headers, json=payload
        ) as response:
            if response.is_error:
                await response.aread()
                raise self._status_error(response)
            async for line in response.aiter_lines():
                event = parse_sse_line(line)
                if event is None:
                    continue
                if event.get("usage"):
                    self.record_usage(event["usage"])
                choices = event.get("choices") or []
                content = (choices[0].get("delta") or {}).get("content") if choices else None
                if content:
                    text = think.feed(content)
                    if text:
                        yield text
        tail = think.flush()
        if tail:
            yield tail

    def _status_error(self, response: httpx.Response) -> httpx.HTTPStatusError:
        # Name the model and keep NVIDIA's message: a bare "410 Gone" hides that the model was retired.
        return httpx.HTTPStatusError(
            f"NVIDIA NIM {response.status_code} for model '{self.model}': {response.text[:300]}",
            request=response.request,
            response=response,
        )
