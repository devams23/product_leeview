import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

import main
from auth import TokenPayload, get_current_user, get_raw_jwt
from services.keys import ResolvedKeys

BODY = {"leetcode_slug": "two-sum", "leetcode_title": "Two Sum", "problem_difficulty": "Easy"}
USER_GONE = {
    "message": 'insert or update on table "interview_sessions" violates foreign key constraint "interview_sessions_user_id_fkey"',
    "code": "23503",
    "hint": None,
    "details": 'Key is not present in table "users".',
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "resolve_keys", lambda user_id: ResolvedKeys("nv-key", "", "dg-key"))
    main.app.dependency_overrides[get_raw_jwt] = lambda: "token"
    main.app.dependency_overrides[get_current_user] = lambda: TokenPayload(sub="gone-user", aud="authenticated", exp=2, iat=1)
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def fail_with(monkeypatch, exc):
    def create_session(**_):
        raise exc

    monkeypatch.setattr(main, "create_session", create_session)


def test_token_for_a_deleted_account_asks_for_sign_in(client, monkeypatch):
    fail_with(monkeypatch, APIError(USER_GONE))
    res = client.post("/sessions", json=BODY)
    assert res.status_code == 401


def test_other_foreign_key_failures_stay_server_errors(client, monkeypatch):
    fail_with(monkeypatch, APIError({**USER_GONE, "message": 'violates foreign key constraint "other_fkey"'}))
    assert client.post("/sessions", json=BODY).status_code == 502


def test_other_database_failures_stay_server_errors(client, monkeypatch):
    fail_with(monkeypatch, RuntimeError("connection reset"))
    assert client.post("/sessions", json=BODY).status_code == 502
