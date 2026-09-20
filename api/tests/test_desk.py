import asyncio
import json
import os
import time

from fastapi.testclient import TestClient

from atlas_api.case import World
from atlas_api.case_store import CaseStore
from atlas_api.desk import DeskPolicy, allowed_options, depth_floor, detect_conflicts, replay, verify_numbers
from atlas_api.engine import DEFAULT_RULES_DIR, RulesFile, assess, estimate_premium
from atlas_api.events import DecisionP, DeskEvent, NoteP, PlanP

RULES = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")


def test_verify_numbers_rejects_a_planted_number():
    facts = ["TIV $2,073,000 via Insured.hq", "year_built 2023", "Premium est. $6,038-$9,869 from 27 comps"]
    assert verify_numbers("TIV $2.1M, built 2023, 27 comparables put premium at $6,038-$9,869.", facts) == []
    assert verify_numbers("premium $90K on a $2.1M building", facts) == ["$90K"]


def test_138_floor_conflicts_and_allowed_set():
    w = World.load()
    case = w.case("SUB-138")
    a = assess(case, RULES)
    assert depth_floor(a, 2_073_000, DeskPolicy())[0] == "standard"
    assert depth_floor(assess(w.case("SUB-133"), RULES), 1e6, DeskPolicy())[0] == "skim"
    enriched = assess(case.with_fact("premium", estimate_premium(case, w.bound_comparables("property")), by="t"), RULES)
    conflicts = detect_conflicts(enriched, RULES, hazard_total=0.97, portfolio_points=-2.3)
    ids = {c.conflict_id for c in conflicts}
    assert {"estimate_vs_threshold:premium", "appetite_vs_hazard"} <= ids
    for c in conflicts:   # an estimate may never decline on its own
        assert "decline" not in c.allowed and set(c.allowed) <= set(allowed_options(enriched))


def _record(store: CaseStore, case_id: str) -> None:
    t0 = time.time() - 2
    e1 = DeskEvent.make(case_id, "rtest", "lead", PlanP(text="plan", depth="standard", floor="standard", deep_dive=True), t0=t0)
    e1.t_ms = 0
    e2 = DeskEvent.make(case_id, "rtest", "lead", DecisionP(text="d", verdict="request_info", explanation="x", verified=True), t0=t0)
    e2.t_ms = 2000
    e3 = DeskEvent.make(case_id, "rtest", "system", NoteP(text="Run closed", calls=1), t0=t0)
    e3.t_ms = 2100
    for e in (e1, e2, e3):
        store.append(e)


def test_replay_scales_timing_and_needs_no_network(tmp_path):
    store = CaseStore.open(tmp_path / "r.sqlite")
    _record(store, "999")

    async def collect():
        t = time.monotonic()
        out = [e async for e in replay(store, "999", speed=20)]
        return out, time.monotonic() - t

    out, secs = asyncio.run(collect())
    assert [e.kind for e in out] == ["plan", "decision", "note"] and 0.08 <= secs < 1.0


def test_events_endpoint_json_and_sse_replay_offline(tmp_path, monkeypatch):
    monkeypatch.setenv("ATLAS_DB", str(tmp_path / "api.sqlite"))
    monkeypatch.setenv("ATLAS_OFFLINE", "1")
    from atlas_api.app import app
    with TestClient(app) as client:
        _record(CaseStore.open(), "138")
        rows = client.get("/cases/138/events?replay=0").json()
        assert [r["kind"] for r in rows] == ["plan", "decision", "note"] and rows[0]["body"]["text"] == "plan"
        with client.stream("GET", "/cases/138/events?replay=1&speed=50") as resp:
            data = [json.loads(ln[6:]) for ln in resp.iter_lines() if ln.startswith("data: ")]
        assert [d["seq"] for d in data] == [1, 2, 3]
        assert client.post("/desk/run", json={"caseIds": ["138"], "mode": "live"}).json()["mode"] == "replay"
        from atlas_api import app as app_mod
        app_mod.apply_desk_run(app_mod.get_store(), app_mod._world, "138")
        view = client.get("/cases/138").json()
        assert view["explanation"] == "x" and view["explanationVerified"] is True


def test_ask_serves_cache_and_says_so_offline(tmp_path, monkeypatch):
    from atlas_api.ask import _key, ask
    monkeypatch.setenv("ATLAS_OFFLINE", "1")
    store = CaseStore.open(tmp_path / "ask.sqlite")
    store.cache_set(_key("Open property submissions with no premium"), {"answer": "cached", "attempts": []})
    assert asyncio.run(ask("open property  submissions with no premium", store))["answer"] == "cached"
    miss = asyncio.run(ask("something new", store))
    assert miss["attempts"] == [] and "Offline" in miss["answer"]


def test_combined_stream_run_totals_and_run_guard(tmp_path, monkeypatch):
    monkeypatch.setenv("ATLAS_DB", str(tmp_path / "live.sqlite"))
    monkeypatch.setenv("ATLAS_OFFLINE", "1")
    from atlas_api.app import app
    with TestClient(app) as client:
        store = CaseStore.open()
        _record(store, "138")
        _record(store, "126")

        with client.stream("GET", "/events/stream?cases=138,126&replay=1&speed=50") as resp:
            seen = [json.loads(ln[6:]) for ln in resp.iter_lines() if ln.startswith("data: ") and ln != "data: {}"]
        assert len(seen) == 6 and {e["caseId"] for e in seen} == {"138", "126"}
        assert [e["tMs"] for e in seen] == sorted(e["tMs"] for e in seen)

        totals = client.get("/runs/rtest").json()
        assert totals["totals"] == {"cases": 2, "events": 6, "calls": 2, "costUsd": 0.0, "elapsedS": 0.0, "done": True}

        # a second live run on a case already running is refused
        from atlas_api import app as app_mod
        app_mod._running.add("138")
        monkeypatch.delenv("ATLAS_OFFLINE")
        try:
            assert client.post("/desk/run", json={"caseIds": ["138"], "mode": "live"}).status_code == 409
        finally:
            app_mod._running.discard("138")
