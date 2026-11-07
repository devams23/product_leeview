"""NVIDIA NIM -> OpenRouter fallback, on the real providers with scripted HTTP. No network."""

import asyncio
import json

import httpx
import pytest

from config import get_settings
from services.keys import MissingKeysError, ResolvedKeys
from services.llm import factory
from services.llm.fallback import FallbackLLMProvider
from services.llm.nvidia_nim import NVIDIANIMProvider
from services.llm.openrouter import OpenRouterProvider
from tests.fakes import ScriptedAPI, completion, down, sse


def chain(nim_answer, or_answer):
    nim, router = NVIDIANIMProvider(api_key="nim-user-key"), OpenRouterProvider(api_key="or-user-key")
    nim_api, or_api = ScriptedAPI(nim_answer), ScriptedAPI(or_answer)
    nim_api.attach(nim)
    or_api.attach(router)
    return FallbackLLMProvider([nim, router]), nim_api, or_api


async def collect(stream):
    return "".join([piece async for piece in stream])


def streaming(*pieces):
    return lambda body: httpx.Response(200, text=sse(*pieces), headers={"content-type": "text/event-stream"})


def test_stream_falls_back_to_openrouter_when_nim_is_down():
    llm, nim_api, or_api = chain(down(503), streaming("Hello ", "there."))

    text = asyncio.run(collect(llm.stream([{"role": "user", "content": "hi"}])))

    assert text == "Hello there."
    assert len(nim_api.requests) == 1 and len(or_api.requests) == 1
    assert llm.last_provider == "openrouter"
    # Each provider is called with the user's own key.
    assert nim_api.auth == ["Bearer nim-user-key"]
    assert or_api.auth == ["Bearer or-user-key"]


def test_failed_provider_cools_down_and_is_skipped_on_the_next_turn():
    llm, nim_api, or_api = chain(down(500), streaming("Fine."))

    async def two_turns():
        await collect(llm.stream([{"role": "user", "content": "one"}]))
        await collect(llm.stream([{"role": "user", "content": "two"}]))

    asyncio.run(two_turns())

    assert len(nim_api.requests) == 1  # not retried while it cools down
    assert len(or_api.requests) == 2


def test_healthy_primary_is_the_only_provider_called():
    llm, nim_api, or_api = chain(streaming("From NIM."), streaming("unused"))

    assert asyncio.run(collect(llm.stream([{"role": "user", "content": "hi"}]))) == "From NIM."
    assert or_api.requests == []
    assert llm.last_provider == "nvidia_nim"


def test_stream_that_already_spoke_is_not_restarted_elsewhere():
    class HalfStream(NVIDIANIMProvider):
        async def stream(self, messages, temperature=0.6, max_tokens=400):
            yield "Half a sen"
            raise httpx.ReadError("connection reset")

    nim = HalfStream(api_key="k")
    router = OpenRouterProvider(api_key="k2")
    or_api = ScriptedAPI(streaming("unused"))
    or_api.attach(router)
    llm = FallbackLLMProvider([nim, router])

    with pytest.raises(httpx.ReadError):
        asyncio.run(collect(llm.stream([{"role": "user", "content": "hi"}])))
    assert or_api.requests == []


def test_structured_output_falls_back():
    answer = json.dumps({"response_text": "Sure.", "next_state": "AWAITING_APPROACH"})
    llm, nim_api, or_api = chain(down(502), lambda body: httpx.Response(200, json=completion(answer)))
    schema = {
        "type": "object",
        "properties": {"response_text": {"type": "string"}, "next_state": {"type": "string"}},
        "required": ["response_text", "next_state"],
    }

    result = asyncio.run(llm.generate_structured([{"role": "user", "content": "hi"}], schema, max_attempts=1))

    assert result["next_state"] == "AWAITING_APPROACH"
    assert llm.last_attempts == 2
    assert llm.usage_snapshot()[0] > 0  # token usage is summed across the chain


def test_every_provider_down_raises_the_last_error():
    llm, _, _ = chain(down(503), down(429))
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(collect(llm.stream([{"role": "user", "content": "hi"}])))


@pytest.fixture
def nim_primary(monkeypatch):
    monkeypatch.setattr(get_settings(), "llm_provider", "nvidia_nim")


def test_factory_orders_primary_first_and_skips_missing_keys(nim_primary):
    both = factory.create_llm_provider(ResolvedKeys(nvidia_nim="a", openrouter="b", deepgram="c"))
    assert isinstance(both, FallbackLLMProvider)
    assert [p.provider_name for p in both.providers] == ["nvidia_nim", "openrouter"]

    only_router = factory.create_llm_provider(ResolvedKeys(openrouter="b", deepgram="c"))
    assert isinstance(only_router, OpenRouterProvider)


def test_factory_without_llm_keys_refuses(nim_primary):
    with pytest.raises(MissingKeysError) as err:
        factory.create_llm_provider(ResolvedKeys(deepgram="c"))
    assert err.value.missing == ["llm"]
