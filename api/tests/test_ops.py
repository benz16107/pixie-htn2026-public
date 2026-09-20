"""The Sentry ops tool (docs/research/sentry.md item 13) is gated behind ATLAS_SENTRY_MCP=1 and
must never spawn npx by default -- the route stays 503 with the flag unset (the normal test/CI
state, since .env doesn't set it)."""

import os

import pytest
from fastapi.testclient import TestClient

from atlas_api.app import app
from atlas_api.ops import enabled


@pytest.fixture(scope="module")
def client(tmp_path_factory) -> TestClient:
    os.environ["ATLAS_DB"] = str(tmp_path_factory.mktemp("db") / "atlas.sqlite")
    with TestClient(app) as c:
        yield c


def test_disabled_by_default():
    assert enabled() is False


def test_ops_ask_is_503_when_disabled(client, monkeypatch):
    monkeypatch.delenv("ATLAS_SENTRY_MCP", raising=False)
    resp = client.post("/ops/ask", json={"question": "what broke in the last hour?"})
    assert resp.status_code == 503
