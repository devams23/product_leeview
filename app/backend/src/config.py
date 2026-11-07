from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Server-owned provider keys. Used only when ALLOW_SERVER_KEYS is true (self-hosting / local dev);
    # otherwise every user brings their own keys from the dashboard profile.
    deepgram_api_key: str = ""
    nvidia_nim_api_key: str = ""
    allow_server_keys: bool = False
    # Fernet key that encrypts users' saved API keys. Generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    key_encryption_key: str = ""
    # Lifetime of the Deepgram tokens the extension uses to open its speech-to-text socket.
    stt_token_ttl_s: int = 60
    # How long a dropped interview waits for the client to reconnect before it is wrapped up.
    resume_grace_s: float = 45.0
    nvidia_nim_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_nim_model: str = "nvidia/llama-3.1-nemotron-70b-instruct"
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "meta-llama/llama-3.2-3b-instruct:free"
    # USD per million tokens for the configured model; 0 leaves the LLM share of cost_usd at zero.
    llm_input_price_per_mtok: float = 0.0
    llm_output_price_per_mtok: float = 0.0
    # "mock" replays canned files from sample_responses/; use it only for offline UI work.
    llm_provider: str = "nvidia_nim"
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    # Comma-separated list of allowed browser origins. "*" is dev-only.
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        # SUPABASE_JWT_SECRET is read directly in auth.py; ignore it here.
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
