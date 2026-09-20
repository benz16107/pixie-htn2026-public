"""HTTP contract acceptance tests."""

import os
import time

import pytest
from fastapi.testclient import TestClient

from atlas_api.app import app


@pytest.fixture(scope="module")
def client(tmp_path_factory) -> TestClient:
    os.environ["ATLAS_DB"] = str(tmp_path_factory.mktemp("db") / "atlas.sqlite")   # never the recorded runs
    with TestClient(app) as c:  # runs the startup event once, populating the CaseStore
        yield c


def test_health(client):
    assert client.get("/health").json() == {"ok": True}


def test_queue_open_returns_21_rows_under_500ms(client):
    t0 = time.monotonic()
    resp = client.get("/queue?view=open")
    elapsed_ms = (time.monotonic() - t0) * 1000
    assert resp.status_code == 200
    rows = resp.json()
    commercial = [row for row in rows if row["line"] != "tenant"]
    assert len(commercial) == 21
    assert elapsed_ms < 500

    row = rows[0]
    assert {"caseId", "insured", "line", "state", "status", "valueAtStake", "region",
             "score", "decision", "issues", "deepDived", "enrichmentDelta"} <= set(row)
    assert row["region"] == "us" and set(row["score"]) == {"lo", "hi"}
    assert row["decision"]["kind"] in {"accept", "refer", "decline", "approve", "open", "routed"}


def test_queue_is_region_aware(client):
    """Tenant quotes join the underwriter queue only as referrals, at the bottom, labelled."""
    quote = {"address": "180 Queen St W", "answers": {"contentsValue": 30000, "unitLevel": "upper",
                                                       "claims3yr": 0, "deductible": 1000}}
    approved = client.post("/quote/tenant", json=quote).json()
    referred = client.post("/quote/tenant", json={**quote, "answers": {**quote["answers"],
                                                                        "unitLevel": "basement",
                                                                        "claims3yr": 3}}).json()
    open_rows = client.get("/queue?view=open").json()
    ids = [r["caseId"] for r in open_rows]
    assert approved["caseId"] not in ids                      # an approved quote never enters the queue
    if referred["decision"]["kind"] == "refer":
        assert ids[-1] == referred["caseId"]                  # referrals sort last
        row = open_rows[-1]
        assert row["region"] == "toronto" and row["label"] == "Consumer referral" and row["score"] is None
    assert all(r["region"] == "us" for r in open_rows if r["line"] != "tenant")

    consumer = client.get("/queue?view=consumer").json()
    assert {r["caseId"] for r in consumer} >= {approved["caseId"], referred["caseId"]}
    assert all(r["region"] == "toronto" for r in consumer)
    view = client.get(f"/cases/{approved['caseId']}").json()   # both kinds still resolve
    assert view["kind"] == "tenant" and view["score"] is None and view["region"] == "toronto"


def test_queue_all_returns_158_rows(client):
    rows = client.get("/queue?view=all").json()
    assert len([row for row in rows if row["line"] != "tenant"]) == 158


def test_queue_decision_variants_match_contract_shape(client):
    rows = client.get("/queue?view=all").json()
    by_kind = {r["decision"]["kind"]: r["decision"] for r in rows}
    assert "routed" in by_kind
    assert set(by_kind["routed"]) == {"kind", "to", "because", "reason"}
    assert "open" in by_kind
    assert set(by_kind["open"]) == {"kind", "straddles", "flippers"}
    assert "decline" in by_kind
    assert set(by_kind["decline"]) == {"kind", "because", "by"}


def test_case_138_view(client):
    resp = client.get("/cases/138")
    assert resp.status_code == 200
    view = resp.json()
    assert view["caseId"] == "138"
    assert view["title"] == "Lumen Data Works Inc"
    fact_ids = {f["id"] for f in view["facts"]}
    assert {"tiv", "premium", "business_type", "primary_admin"} <= fact_ids
    tiv_fact = next(f for f in view["facts"] if f["id"] == "tiv")
    assert tiv_fact["display"] == "$2,073,000"
    assert tiv_fact["provenance"] == "known"
    premium_fact = next(f for f in view["facts"] if f["id"] == "premium")
    assert premium_fact["provenance"] == "missing"
    assert premium_fact["resolver"] == "broker"
    assert view["decision"]["kind"] == "open"
    assert view["explanationVerified"] is True


def test_case_not_found_is_404(client):
    assert client.get("/cases/999999").status_code == 404


def test_backtest_route_serves_generated_report(client):
    report = client.get("/backtest")
    assert report.status_code == 200
    assert report.json()["b4"]["factors"][0]["declines"] == 17


def test_cors_allows_web_localhost(client):
    resp = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_allows_expo_web(client):
    resp = client.options(
        "/quote/tenant",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:8081"


def test_map_endpoints(client):
    pins = client.get("/map/pins").json()
    assert len(pins) == 21 and {"caseId", "decision", "site", "cell", "perils"} <= set(pins[0])
    hexes = client.get("/map/book?res=5").json()
    assert hexes and len(hexes[0]["ring"]) >= 5 and 0 <= hexes[0]["level"] <= 4
    flood = client.get("/map/book?res=3&peril=flood").json()
    assert sum(h["value"] for h in flood) < sum(h["value"] for h in client.get("/map/book?res=3").json())


def test_explainability_endpoints(client):
    explain = client.get("/cases/138/explain").json()
    assert explain["reconciles"] is True and explain["steps"][0]["key"] == "line"
    assert {"key", "label", "band", "kind", "pointsLo", "pointsHi", "runningLo", "runningHi", "capped",
            "rule", "value", "provenance", "source"} <= set(explain["steps"][0])

    whatif = client.post("/cases/138/whatif", json={"overrides": {"premium": 80000}}).json()
    assert whatif["after"]["decision"]["kind"] == "accept" and whatif["decisiveOverride"] == "premium"

    sensitivity = client.get("/cases/138/sensitivity").json()
    premium = next(f for f in sensitivity["facts"] if f["fact"] == "premium")
    assert premium["movesDecision"] and premium["flip"]["at"] == 50000
    assert sensitivity["facts"][0]["movesDecision"]      # ranked: the facts that move the decision first

    precedent = client.get("/cases/138/precedent?size=2").json()
    assert len(precedent["hits"]) == 2 and precedent["hits"][0]["basis"]

    assert client.get("/cases/9999/explain").status_code == 404


def test_surface_answers_live_and_caches(client):
    t0 = time.monotonic()
    cold = client.post("/cases/138/surface", json={}).json()
    cold_ms = (time.monotonic() - t0) * 1000
    assert cold["shape"] == [11, 11, 11] and cold["points"] == 1331 and cold["cached"] is False
    assert [a["fact"] for a in cold["axes"]] == ["premium", "year_built", "tiv"]
    assert cold_ms < 500, cold["ms"]

    t0 = time.monotonic()
    warm = client.post("/cases/138/surface", json={}).json()
    assert warm["cached"] is True and warm["grid"] == cold["grid"]
    assert (time.monotonic() - t0) * 1000 < 50      # a repeat must not re-run the engine

    two = client.post("/cases/138/surface", json={"axes": ["premium", "year_built"], "resolution": 7}).json()
    assert two["shape"] == [7, 7] and len(two["grid"]["tier"]) == 49
    assert client.post("/cases/138/surface", json={"axes": ["premium", "primary_admin"]}).status_code == 400
    assert client.post("/cases/9999/surface", json={}).status_code == 404


def test_tenant_explain_returns_the_price_waterfall(client):
    quote = client.post("/quote/tenant", json={"address": "180 Queen St W", "answers": {
        "contentsValue": 30000, "unitLevel": "basement", "claims3yr": 0, "deductible": 1000}}).json()
    out = client.get(f"/cases/{quote['caseId']}/explain").json()
    assert out["kind"] == "tenant" and out["reconciles"] is True
    assert out["steps"][0]["kind"] == "base" and out["annual"] == quote["annual"]
    assert any("percentile" in v["text"] for v in out["percentiles"].values())
