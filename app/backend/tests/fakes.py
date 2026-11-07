"""Stand-ins for the network: provider HTTP scripts and an in-memory Supabase table API.

Nothing here opens a socket. LLM providers get an httpx client on a MockTransport, so the real
request/response code (headers, SSE parsing, error handling) runs against scripted answers.
"""

import json
from typing import Callable

import httpx


def sse(*pieces: str, usage: dict | None = None) -> str:
    """A chat-completions SSE body that streams `pieces` as content deltas."""
    lines = [f"data: {json.dumps({'choices': [{'delta': {'content': p}}]})}\n\n" for p in pieces]
    if usage:
        lines.append(f"data: {json.dumps({'choices': [], 'usage': usage})}\n\n")
    lines.append("data: [DONE]\n\n")
    return "".join(lines)


def completion(content: str) -> dict:
    return {
        "choices": [{"message": {"content": content}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    }


class ScriptedAPI:
    """One provider's endpoint. `answer(request_json)` returns an httpx.Response; every request is recorded."""

    def __init__(self, answer: Callable[[dict], httpx.Response]):
        self.answer = answer
        self.requests: list[dict] = []
        self.auth: list[str] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content or b"{}")
        self.requests.append(body)
        self.auth.append(request.headers.get("authorization", ""))
        return self.answer(body)

    def attach(self, provider) -> None:
        """Route the provider's HTTP client to this script instead of the internet."""
        provider._client = httpx.AsyncClient(transport=httpx.MockTransport(self.handler))


def down(status: int = 503) -> Callable[[dict], httpx.Response]:
    return lambda body: httpx.Response(status, json={"error": "unavailable"})


class _Query:
    def __init__(self, table: "FakeTable", op: str, payload=None):
        self.table = table
        self.op = op
        self.payload = payload
        self.filters: list[tuple[str, object]] = []

    def select(self, *_):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_):
        return self

    def _match(self, row):
        return all(row.get(c) == v for c, v in self.filters)

    def execute(self):
        rows = self.table.rows
        if self.op == "select":
            return type("R", (), {"data": [dict(r) for r in rows if self._match(r)]})()
        if self.op == "delete":
            self.table.rows = [r for r in rows if not self._match(r)]
            return type("R", (), {"data": []})()
        if self.op == "upsert":
            key = {k: self.payload[k] for k in self.table.primary_key}
            self.table.rows = [r for r in rows if any(r.get(k) != v for k, v in key.items())]
            self.table.rows.append(dict(self.payload))
            return type("R", (), {"data": [self.payload]})()
        raise AssertionError(self.op)


class FakeTable:
    def __init__(self, primary_key: tuple[str, ...]):
        self.primary_key = primary_key
        self.rows: list[dict] = []

    def select(self, *columns):
        return _Query(self, "select")

    def delete(self):
        return _Query(self, "delete")

    def upsert(self, payload):
        return _Query(self, "upsert", payload)


class FakeSupabase:
    def __init__(self):
        self.tables = {"user_api_keys": FakeTable(("user_id", "provider"))}

    def table(self, name):
        return self.tables[name]
