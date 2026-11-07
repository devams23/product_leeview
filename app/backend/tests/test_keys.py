"""Bring-your-own-keys: encryption, masking, validation, resolution and the HTTP endpoints. No network."""

import asyncio

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

import main
from auth import TokenPayload, get_current_user, get_raw_jwt
from config import get_settings
from services import deepgram, keys
from tests.fakes import FakeSupabase

NIM_KEY = "nvapi-" + "a" * 40
DG_KEY = "d" * 40


@pytest.fixture
def store(monkeypatch):
    db = FakeSupabase()
    monkeypatch.setattr(keys, "_db", lambda: db)
    monkeypatch.setattr(get_settings(), "key_encryption_key", Fernet.generate_key().decode())
    monkeypatch.setattr(get_settings(), "allow_server_keys", False)
    monkeypatch.setattr(get_settings(), "llm_provider", "nvidia_nim")
    return db


def test_keys_are_encrypted_at_rest(store):
    keys.save_key("u1", "nvidia_nim", f"  {NIM_KEY}  ")

    row = store.tables["user_api_keys"].rows[0]
    assert NIM_KEY not in row["ciphertext"]
    assert row["hint"] == "…aaaa"
    assert keys.load_user_keys("u1") == {"nvidia_nim": NIM_KEY}
    assert keys.load_user_keys("someone-else") == {}


def test_saving_again_replaces_the_key(store):
    keys.save_key("u1", "deepgram", DG_KEY)
    keys.save_key("u1", "deepgram", "e" * 40)
    assert keys.load_user_keys("u1") == {"deepgram": "e" * 40}


def test_rotated_secret_skips_undecryptable_rows(store, monkeypatch):
    keys.save_key("u1", "deepgram", DG_KEY)
    monkeypatch.setattr(get_settings(), "key_encryption_key", Fernet.generate_key().decode())
    assert keys.load_user_keys("u1") == {}


@pytest.mark.parametrize("bad", ["", "short", "has a space in the middle of it", "x" * 600])
def test_validation_rejects_paste_mistakes(bad):
    with pytest.raises(ValueError):
        keys.validate_key("deepgram", bad)


def test_resolve_uses_server_keys_only_when_allowed(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "deepgram_api_key", "server-dg")
    monkeypatch.setattr(settings, "nvidia_nim_api_key", "server-nim")
    monkeypatch.setattr(settings, "openrouter_api_key", "")

    monkeypatch.setattr(settings, "allow_server_keys", False)
    mine = keys.resolve_keys("u", user_keys={"openrouter": "my-or"})
    assert (mine.nvidia_nim, mine.openrouter, mine.deepgram) == ("", "my-or", "")
    assert mine.missing() == ["deepgram"]

    monkeypatch.setattr(settings, "allow_server_keys", True)
    topped = keys.resolve_keys("u", user_keys={"openrouter": "my-or"})
    assert (topped.nvidia_nim, topped.openrouter, topped.deepgram) == ("server-nim", "my-or", "server-dg")
    assert topped.missing() == []


def test_missing_encryption_secret_is_a_server_error(monkeypatch):
    monkeypatch.setattr(get_settings(), "key_encryption_key", "")
    monkeypatch.setattr(get_settings(), "allow_server_keys", False)
    with pytest.raises(keys.KeyStoreUnavailable):
        keys.resolve_keys("u")


def test_resolved_keys_never_print_their_values():
    assert "secret-value" not in repr(keys.ResolvedKeys(nvidia_nim="secret-value"))


# --- HTTP endpoints ---

@pytest.fixture
def client(store):
    main.app.dependency_overrides[get_raw_jwt] = lambda: "token"
    main.app.dependency_overrides[get_current_user] = lambda: TokenPayload(sub="u1", aud="authenticated", exp=2, iat=1)
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_key_endpoints_never_return_a_key(client):
    listed = client.get("/me/keys").json()
    assert listed["server_keys_allowed"] is False
    assert all(not v["saved"] for v in listed["keys"].values())

    saved = client.put("/me/keys/nvidia_nim", json={"key": NIM_KEY})
    assert saved.status_code == 200
    assert saved.json()["keys"]["nvidia_nim"] == {"saved": True, "hint": "…aaaa", "updated_at": saved.json()["keys"]["nvidia_nim"]["updated_at"]}
    assert NIM_KEY not in saved.text
    assert NIM_KEY not in client.get("/me/keys").text

    removed = client.delete("/me/keys/nvidia_nim").json()
    assert removed["keys"]["nvidia_nim"]["saved"] is False


def test_key_endpoints_reject_bad_input(client):
    assert client.put("/me/keys/openai", json={"key": NIM_KEY}).status_code == 404
    assert client.put("/me/keys/deepgram", json={"key": "nope"}).status_code == 422
    assert client.put("/me/keys/deepgram", json={"key": "x" * 2000}).status_code == 422


def test_session_needs_keys_before_the_mic_opens(client):
    res = client.post("/sessions", json={"leetcode_slug": "two-sum", "leetcode_title": "Two Sum"})
    assert res.status_code == 412
    assert res.json()["detail"]["code"] == "KEYS_MISSING"
    assert res.json()["detail"]["missing"] == ["llm", "deepgram"]


def test_stt_token_needs_a_deepgram_key(client):
    res = client.post("/stt/token")
    assert res.status_code == 412
    assert res.json()["detail"]["missing"] == ["deepgram"]


def test_stt_token_is_minted_from_the_users_key(client, monkeypatch):
    client.put("/me/keys/deepgram", json={"key": DG_KEY})
    seen = {}

    async def fake_mint(api_key, ttl_seconds=60, transport=None):
        seen["key"] = api_key
        return {"access_token": "temp-token", "expires_in": ttl_seconds}

    monkeypatch.setattr(main, "mint_stt_token", fake_mint)
    res = client.post("/stt/token")

    assert res.status_code == 200
    assert res.json()["access_token"] == "temp-token"
    assert seen["key"] == DG_KEY
    assert DG_KEY not in res.text


def test_stt_token_reports_a_rejected_key(client, monkeypatch):
    client.put("/me/keys/deepgram", json={"key": DG_KEY})

    async def rejected(*_, **__):
        raise deepgram.DeepgramKeyRejected("401")

    monkeypatch.setattr(main, "mint_stt_token", rejected)
    res = client.post("/stt/token")
    assert res.status_code == 412
    assert res.json()["detail"]["code"] == "KEY_REJECTED"


# --- Deepgram token grant, on a scripted transport ---

def test_mint_stt_token_calls_the_grant_endpoint():
    seen = {}

    def grant(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = request.content
        return httpx.Response(200, json={"access_token": "jwt-like", "expires_in": 30})

    token = asyncio.run(deepgram.mint_stt_token(DG_KEY, 30, transport=httpx.MockTransport(grant)))

    assert token == {"access_token": "jwt-like", "expires_in": 30}
    assert seen["url"] == deepgram.GRANT_URL
    assert seen["auth"] == f"Token {DG_KEY}"
    assert b'"ttl_seconds":30' in seen["body"].replace(b" ", b"")


def test_mint_stt_token_rejected_key():
    transport = httpx.MockTransport(lambda r: httpx.Response(401, json={"err": "bad"}))
    with pytest.raises(deepgram.DeepgramKeyRejected):
        asyncio.run(deepgram.mint_stt_token(DG_KEY, transport=transport))
