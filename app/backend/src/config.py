from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    deepgram_api_key: str
    nvidia_nim_api_key: str
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "meta-llama/llama-3.2-3b-instruct:free"
    llm_provider: str = "nvidia_nim"
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
