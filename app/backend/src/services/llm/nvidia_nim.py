import json
import re
import httpx
from typing import Any

from config import get_settings
from services.llm.base import LLMProvider

settings = get_settings()


class NVIDIANIMProvider(LLMProvider):
    """NVIDIA NIM LLM provider implementation."""

    def __init__(self):
        self.api_key = settings.nvidia_nim_api_key
        self.base_url = settings.nvidia_nim_base_url
        self.model = "meta/llama-3.2-3b-instruct"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        self.timeout = httpx.Timeout(30.0, connect=10.0)

    @property
    def provider_name(self) -> str:
        return "nvidia_nim"

    async def generate(
        self, messages: list[dict[str, str]], temperature: float = 0.7
    ) -> str:
        """Send a chat completion request to NVIDIA NIM."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    def _extract_json(self, text: str) -> str:
        """Extract JSON from text that might contain markdown or extra content."""
        json_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
        if json_match:
            return json_match.group(1)
        json_match = re.search(r"```\s*(\{.*?\})\s*```", text, re.DOTALL)
        if json_match:
            return json_match.group(1)
        json_match = re.search(r"\{.*\}", text, re.DOTALL)
        if json_match:
            return json_match.group(0)
        return text

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        json_schema: dict[str, Any],
        temperature: float = 0.5,
    ) -> dict[str, Any]:
        """Generate a response that conforms to a JSON schema."""
        system_msg = {
            "role": "system",
            "content": (
                "You are a JSON-only response engine. "
                "Return valid JSON matching the schema exactly. "
                "Do not include markdown formatting, code fences, or extra text. "
                "Output ONLY the JSON object."
            ),
        }

        schema_msg = {
            "role": "system",
            "content": f"Schema: {json.dumps(json_schema)}",
        }

        all_messages = [system_msg, schema_msg] + messages

        last_error = None
        for attempt in range(3):
            try:
                text = await self.generate(all_messages, temperature=temperature)
                json_text = self._extract_json(text)
                return json.loads(json_text)
            except json.JSONDecodeError as e:
                last_error = e
                print(f"[NVIDIA NIM] JSON decode attempt {attempt + 1} failed: {e}")
                print(f"[NVIDIA NIM] Raw response: {text[:500]}")
                if attempt < 2:
                    continue
        
        raise last_error or json.JSONDecodeError("Failed to parse JSON after retries", "", 0)
