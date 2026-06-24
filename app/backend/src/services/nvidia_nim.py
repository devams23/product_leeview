import json
import httpx
from typing import Any

from  config import get_settings

settings = get_settings()


class NVIDIA_NIM_Client:
    def __init__(self):
        self.api_key = settings.nvidia_nim_api_key
        self.base_url = settings.nvidia_nim_base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def generate(self, messages: list[dict[str, str]], temperature: float = 0.7) -> str:
        """Send a chat completion request to NVIDIA NIM."""
        payload = {
            "model": "meta/llama-3.2-3b-instruct",  # adjust model as needed
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1024,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

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
                "Do not include markdown formatting or extra text."
            ),
        }

        schema_msg = {
            "role": "system",
            "content": f"Schema: {json.dumps(json_schema)}",
        }

        all_messages = [system_msg, schema_msg] + messages

        text = await self.generate(all_messages, temperature=temperature)
        return json.loads(text)
