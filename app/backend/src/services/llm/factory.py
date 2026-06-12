from src.config import get_settings
from src.services.llm.base import LLMProvider
from src.services.llm.nvidia_nim import NVIDIANIMProvider
from src.services.llm.openrouter import OpenRouterProvider

settings = get_settings()


def create_llm_provider() -> LLMProvider:
    """Create an LLM provider instance based on configuration."""
    provider = settings.llm_provider.lower()

    if provider == "nvidia_nim":
        return NVIDIANIMProvider()
    elif provider == "openrouter":
        return OpenRouterProvider()
    else:
        raise ValueError(
            f"Unknown LLM provider: {provider}. "
            f"Supported providers: nvidia_nim, openrouter"
        )
