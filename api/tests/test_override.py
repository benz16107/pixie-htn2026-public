"""The bounded underwriter override (docs/OVERRIDE.md): the clamp, the required reason, the
decision recompute and the undo."""

import os

import pytest
from fastapi.testclient import TestClient

from atlas_api import override
from atlas_api.app import app
from atlas_api.engine import DEFAULT_RULES_DIR, RulesFile

RULES = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")


@pytest.fixture(scope="module")
def client(tmp_path_factory) -> TestClient:
    os.environ["ATLAS_DB"] = str(tmp_path_factory.mktemp("db") / "atlas.sqlite")
    with TestClient(app) as c:
        yield c


@pytest.fixture
def case(client) -> str:
    """A scored commercial case, with any earlier override undone."""
    row = next(r for r in client.get("/queue?view=all").json() if r["score"] and r["line"] != "tenant")
    client.delete(f"/cases/{row['caseId']}/override")
    return row["caseId"]


def test_bound_is_refused_not_silently_clamped(client, case):
    for points in (5.5, -7, 100):
        r = client.post(f"/cases/{case}/override", json={"points": points, "reason": "broker knows the roof"})
        assert r.status_code == 400
        assert "5" in r.json()["detail"] and "capped" in r.json()["detail"]
    assert "override" not in client.get(f"/cases/{case}").json()
    assert client.post(f"/cases/{case}/override",
                       json={"points": 5, "reason": "at the bound"}).status_code == 200   # the edge is allowed


def test_reason_is_required(client, case):
    for reason in ("", "   ", "\n"):
        r = client.post(f"/cases/{case}/override", json={"points": 2, "reason": reason})
        assert r.status_code == 400 and "reason" in r.json()["detail"]
    assert client.post(f"/cases/{case}/override", json={"points": 0, "reason": "no-op"}).status_code == 400
    assert "override" not in client.get(f"/cases/{case}").json()


def test_decide_matches_the_engine_on_every_scored_case(client):
    """The recompute mirrors engine.assess's thresholds; this is what stops the two drifting."""
    for row in client.get("/queue?view=all").json():
        if not row["score"] or row["line"] == "tenant" or row["decision"]["kind"] == "routed":
            continue
        assert override.decide(row["score"]["lo"], row["score"]["hi"], RULES) == row["decision"]["kind"]


def test_decision_recomputes_from_the_adjusted_interval(client, case):
    assert override.decide(71, 80, RULES) == "accept"      # thresholds: decline 45, accept 70
    assert override.decide(20, 40, RULES) == "decline"
    assert override.decide(60, 80, RULES) == "open"

    engine = client.get(f"/cases/{case}").json()
    r = client.post(f"/cases/{case}/override", json={"points": -5, "reason": "two open claims the file omits"})
    assert r.status_code == 200
    ov = r.json()["override"]
    assert ov["score"] == {"lo": max(0, engine["score"]["lo"] - 5), "hi": max(0, engine["score"]["hi"] - 5)}
    assert ov["decision"]["kind"] == override.decide(ov["score"]["lo"], ov["score"]["hi"], RULES)
    assert ov["decision"]["by"] == "human" and ov["provenance"] == "human" and ov["bound"] == 5

    view = client.get(f"/cases/{case}").json()
    assert view["score"] == engine["score"], "the engine's own interval is never overwritten"
    assert view["decision"] == engine["decision"]
    assert view["override"]["engineScore"] == engine["score"]
    assert view["override"]["reason"] == "two open claims the file omits"
    row = next(r for r in client.get("/queue?view=all").json() if r["caseId"] == case)
    assert row["override"]["points"] == -5

    step = client.get(f"/cases/{case}/explain").json()["steps"][-1]
    assert step["kind"] == "human" and step["provenance"] == "human"
    assert (step["runningLo"], step["runningHi"]) == (ov["score"]["lo"], ov["score"]["hi"])


def test_it_lands_in_the_desk_event_ledger_as_a_human(client, case):
    client.post(f"/cases/{case}/override", json={"points": 3, "reason": "sprinklers inspected last month"})
    ev = [e for e in client.get(f"/cases/{case}/events").json() if e["kind"] == "override"][-1]
    assert ev["actor"] == "human" and ev["body"]["points"] == 3
    assert ev["body"]["reason"] == "sprinklers inspected last month"
    assert ev["body"]["decision_before"] and ev["body"]["decision_after"]      # the audit line is self-contained
    assert ev["body"]["text"].startswith("Underwriter adjusted the score by +3")


def test_undo_and_demo_reset_clear_it(client, case):
    client.post(f"/cases/{case}/override", json={"points": 4, "reason": "mis-click at the booth"})
    assert client.get(f"/cases/{case}").json()["override"]["points"] == 4

    undo = client.delete(f"/cases/{case}/override").json()
    assert undo["removed"] >= 1 and undo["override"] is None
    view = client.get(f"/cases/{case}").json()
    assert "override" not in view and view["score"]
    assert not [e for e in client.get(f"/cases/{case}/events").json() if e["kind"] == "override"]
    assert client.get(f"/cases/{case}/explain").json()["steps"][-1]["kind"] != "human"
    assert client.delete(f"/cases/{case}/override").json()["removed"] == 0      # idempotent

    client.post(f"/cases/{case}/override", json={"points": 2, "reason": "cleared by the demo reset"})
    client.post("/demo/reset")
    assert "override" not in client.get(f"/cases/{case}").json()


def test_unknown_case_is_a_404(client):
    assert client.post("/cases/NOPE/override", json={"points": 1, "reason": "x"}).status_code == 404
    assert client.delete("/cases/NOPE/override").status_code == 404
