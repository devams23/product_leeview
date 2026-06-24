from config import get_settings
from services.llm.base import LLMProvider
from services.llm.nvidia_nim import NVIDIANIMProvider
from services.llm.openrouter import OpenRouterProvider
from services.llm.mock import MockLLMProvider

settings = get_settings()


def create_llm_provider() -> LLMProvider:
    """Create an LLM provider instance based on configuration."""
    provider = settings.llm_provider.lower()

    if provider == "nvidia_nim":
        return NVIDIANIMProvider()
    elif provider == "openrouter":
        return OpenRouterProvider()
    elif provider == "mock":
        return MockLLMProvider()
    else:
        raise ValueError(
            f"Unknown LLM provider: {provider}. "
            f"Supported providers: nvidia_nim, openrouter, mock"
        )
