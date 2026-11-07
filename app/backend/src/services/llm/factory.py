from typing import Optional

from config import get_settings
from services.keys import MissingKeysError, ResolvedKeys
from services.llm.base import LLMProvider
from services.llm.fallback import FallbackLLMProvider
from services.llm.mock import MockLLMProvider
from services.llm.nvidia_nim import NVIDIANIMProvider
from services.llm.openrouter import OpenRouterProvider

SUPPORTED = ("nvidia_nim", "openrouter", "mock")


def create_llm_provider(keys: Optional[ResolvedKeys] = None) -> LLMProvider:
    """The interviewer's LLM for one session.

    LLM_PROVIDER names the primary; the other provider is the fallback when the user (or the
    server) has a key for it. `keys` are the session owner's resolved keys; without them the
    server's own keys from settings are used, which is what scripts and tests rely on.
    """
    settings = get_settings()
    primary = settings.llm_provider.lower()
    if primary not in SUPPORTED:
        raise ValueError(f"Unknown LLM provider: {primary}. Supported providers: {', '.join(SUPPORTED)}")
    if primary == "mock":
        return MockLLMProvider()

    if keys is None:
        keys = ResolvedKeys(
            nvidia_nim=settings.nvidia_nim_api_key,
            openrouter=settings.openrouter_api_key,
            deepgram=settings.deepgram_api_key,
        )

    builders = {
        "nvidia_nim": lambda: NVIDIANIMProvider(api_key=keys.nvidia_nim),
        "openrouter": lambda: OpenRouterProvider(api_key=keys.openrouter),
    }
    order = [primary] + [name for name in builders if name != primary]
    chain = [builders[name]() for name in order if getattr(keys, name)]

    if not chain:
        raise MissingKeysError(["llm"])
    if len(chain) == 1:
        return chain[0]
    return FallbackLLMProvider(chain)
