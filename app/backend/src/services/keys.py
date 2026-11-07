"""Bring-your-own-keys: each user's NVIDIA NIM, OpenRouter and Deepgram keys.

Keys are encrypted here with KEY_ENCRYPTION_KEY (Fernet) before they reach the database, and the
table is readable only with the service role (RLS on, no policies). Nothing ever sends a stored key
back to a browser: the dashboard sees a masked hint, and the extension gets short-lived Deepgram
tokens minted from the key instead of the key itself.
"""

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from config import get_settings

logger = logging.getLogger(__name__)

PROVIDERS = ("nvidia_nim", "openrouter", "deepgram")
LLM_PROVIDERS = ("nvidia_nim", "openrouter")
TABLE = "user_api_keys"

# Printable, no whitespace. Real keys are 32-100 characters; the bounds only catch paste mistakes.
_KEY_PATTERN = re.compile(r"^[\x21-\x7e]{16,512}$")


class MissingKeysError(Exception):
    """The session owner has no usable key for something the interview needs.

    `missing` holds "llm" (neither NVIDIA NIM nor OpenRouter) and/or "deepgram".
    """

    def __init__(self, missing: list[str]):
        self.missing = missing
        super().__init__(f"Missing API keys: {', '.join(missing)}")


class KeyStoreUnavailable(Exception):
    """KEY_ENCRYPTION_KEY is not configured, so keys cannot be stored or read."""


@dataclass(frozen=True)
class ResolvedKeys:
    nvidia_nim: str = ""
    openrouter: str = ""
    deepgram: str = ""

    def missing(self) -> list[str]:
        gaps = []
        if not (self.nvidia_nim or self.openrouter):
            gaps.append("llm")
        if not self.deepgram:
            gaps.append("deepgram")
        return gaps

    def __repr__(self) -> str:  # never print keys, even in a traceback
        held = [name for name in PROVIDERS if getattr(self, name)]
        return f"ResolvedKeys(held={held})"


def _fernet() -> Fernet:
    secret = get_settings().key_encryption_key
    if not secret:
        raise KeyStoreUnavailable("KEY_ENCRYPTION_KEY is not set")
    try:
        return Fernet(secret.encode())
    except (ValueError, TypeError) as e:
        raise KeyStoreUnavailable("KEY_ENCRYPTION_KEY is not a valid Fernet key") from e


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def mask(key: str) -> str:
    return f"…{key[-4:]}" if len(key) >= 8 else "…"


def validate_key(provider: str, key: str) -> str:
    """The trimmed key, or ValueError with a message the dashboard can show."""
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'")
    key = (key or "").strip()
    if not _KEY_PATTERN.match(key):
        raise ValueError("That doesn't look like an API key. Paste the whole key, without spaces.")
    return key


def _db():
    # Imported lazily so this module (and the LLM factory that imports it) loads without Supabase.
    from services.supabase_client import supabase

    return supabase


def _rows(user_id: str) -> list[dict]:
    result = _db().table(TABLE).select("provider, ciphertext, hint, updated_at").eq("user_id", user_id).execute()
    return result.data or []


def key_status(user_id: str) -> dict[str, dict]:
    """Per provider: whether a key is saved, its masked hint and when it was saved."""
    saved = {row["provider"]: row for row in _rows(user_id)}
    return {
        name: {
            "saved": name in saved,
            "hint": saved[name]["hint"] if name in saved else None,
            "updated_at": saved[name]["updated_at"] if name in saved else None,
        }
        for name in PROVIDERS
    }


def save_key(user_id: str, provider: str, key: str) -> None:
    key = validate_key(provider, key)
    _db().table(TABLE).upsert({
        "user_id": user_id,
        "provider": provider,
        "ciphertext": encrypt(key),
        "hint": mask(key),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def delete_key(user_id: str, provider: str) -> None:
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'")
    _db().table(TABLE).delete().eq("user_id", user_id).eq("provider", provider).execute()


def load_user_keys(user_id: str) -> dict[str, str]:
    """The user's decrypted keys. A row that no longer decrypts (rotated secret) is skipped."""
    fernet = _fernet()  # a missing secret is a server problem, reported before any query
    keys: dict[str, str] = {}
    for row in _rows(user_id):
        try:
            keys[row["provider"]] = fernet.decrypt(row["ciphertext"].encode()).decode()
        except InvalidToken:
            logger.error("Stored %s key for a user does not decrypt; was KEY_ENCRYPTION_KEY rotated?", row["provider"])
    return keys


def resolve_keys(user_id: str, user_keys: Optional[dict[str, str]] = None) -> ResolvedKeys:
    """The keys a session runs on: the user's own, topped up with the server's when allowed.

    ALLOW_SERVER_KEYS=true is for self-hosting and local development. In a public deployment it
    stays false, so nobody's interview is billed to the operator.
    """
    settings = get_settings()
    if user_keys is None:
        try:
            user_keys = load_user_keys(user_id)
        except KeyStoreUnavailable:
            if not settings.allow_server_keys:
                raise
            user_keys = {}

    def pick(name: str, server_value: str) -> str:
        return user_keys.get(name) or (server_value if settings.allow_server_keys else "")

    return ResolvedKeys(
        nvidia_nim=pick("nvidia_nim", settings.nvidia_nim_api_key),
        openrouter=pick("openrouter", settings.openrouter_api_key),
        deepgram=pick("deepgram", settings.deepgram_api_key),
    )
