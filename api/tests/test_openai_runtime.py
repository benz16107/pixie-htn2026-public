"""A1: the SDK output guardrail, the per-role settings, the trace config and cross-case recall.

Network-free. The one test that needs the SDK to trip a tripwire fakes `Runner.run` raising
`OutputGuardrailTripwireTriggered`, which is exactly what the SDK does when a guardrail returns
`tripwire_triggered=True`; what is under test is what the desk does next.
"""

import asyncio
import time

import pytest
from agents import Agent, OutputGuardrailResult, OutputGuardrailTripwireTriggered

from atlas_api.case import World
from atlas_api.case_store import CaseStore
from atlas_api.desk import CasePlan, Desk, LeadDecision, ModelConfig, ResolutionOut, _CaseRun
from atlas_api.engine import DEFAULT_RULES_DIR, RulesFile, assess
from atlas_api.events import GuardrailP, RecallP
from atlas_api.openai_runtime import (PROSE_FIELDS, ROLE_SETTINGS, model_for, numbers_guardrail, prose,
                                      recall, remember, run_config, session, settings_for, settings_table,
                                      verify_numbers)

RULES = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")


def _run(tmp_path, case_id: str = "138"):
    world = World.load()
    store = CaseStore.open(tmp_path / "g.sqlite")
    desk = Desk(world, store, ModelConfig("none", "none"))
    case = world.case(f"SUB-{case_id}")
    return desk, store, _CaseRun(desk, case_id, case, assess(case, RULES), "rtest", time.time())


# ---------- what the guardrail reads --------------------------------------------------------------

def test_prose_reads_the_free_text_fields_and_skips_the_ids():
    plan = CasePlan(case_id="138", depth="deep", reason="premium is estimated at $6,038", briefs=[])
    text = prose(plan)
    assert "$6,038" in text and "138" not in text        # case_id is code's, not the model's claim
    decision = LeadDecision(verdict="request_info", explanation="TIV is $2.1M",
                            resolutions=[ResolutionOut(conflict_id="c:1", option="request_info",
                                                       reason="the estimate cannot hard-fail")])
    nested = prose(decision)
    assert "$2.1M" in nested and "the estimate cannot hard-fail" in nested
    assert "c:1" not in nested and "conflict_id" not in PROSE_FIELDS


def test_guardrail_trips_only_on_a_number_no_computed_fact_contains():
    facts = ["TIV $2,073,000 via Insured.hq", "Premium est. $6,038-$9,869 from 27 comps"]
    guard = numbers_guardrail(lambda: facts)
    agent = Agent(name="lead")

    def check(text: str):
        out = CasePlan(case_id="138", depth="deep", reason=text, briefs=[])
        return guard.guardrail_function(None, agent, out)

    assert check("TIV is $2.1M and 27 comps put premium at $6,038").tripwire_triggered is False
    tripped = check("the broker quoted $90,000")
    assert tripped.tripwire_triggered is True
    assert tripped.output_info["bad_tokens"] == ["$90,000"] == verify_numbers("the broker quoted $90,000", facts)


def test_every_agent_the_desk_builds_carries_the_guardrail(tmp_path):
    desk, _store, run = _run(tmp_path)
    for agent, role in ((desk._mk(run, "lead", "lead_decide", LeadDecision), "lead_decide"),
                        (desk._agent(run, "hazard", CasePlan), "hazard")):
        assert [g.name for g in agent.output_guardrails] == ["verify_numbers"]
        assert agent.model_settings.reasoning.effort == ROLE_SETTINGS[role][0]
        assert agent.model_settings.verbosity == ROLE_SETTINGS[role][1]


# ---------- a tripwire is an event, not a crash ---------------------------------------------------

def test_a_tripwire_posts_a_guardrail_event_and_returns_the_output_to_the_fallback(tmp_path, monkeypatch):
    desk, store, run = _run(tmp_path)
    agent = desk._mk(run, "lead", "lead_decide", LeadDecision)
    blocked = LeadDecision(verdict="request_info", explanation="the broker quoted $90,000", resolutions=[])

    async def boom(*_a, **_kw):
        raise OutputGuardrailTripwireTriggered(OutputGuardrailResult(
            guardrail=agent.output_guardrails[0], agent_output=blocked, agent=agent,
            output=numbers_guardrail(lambda: run.facts).guardrail_function(None, agent, blocked)))

    monkeypatch.setattr("atlas_api.desk.Runner.run", boom)
    out = asyncio.run(desk._turn(run, agent, "prompt", role="lead_decide", reserve=0))

    assert out is blocked                                      # the caller still runs r.checked()
    event = next(e for e in store.tail("138") if isinstance(e.payload, GuardrailP))
    assert event.payload.tripwire and event.payload.bad_tokens == ["$90,000"]
    assert event.payload.guardrail == "verify_numbers" and event.kind == "guardrail"
    # and the existing fallback still replaces the sentence, so no ungrounded number reaches the log
    assert run.checked(blocked.explanation, "template") == ("template", False)


# ---------- per-role settings and the trace config ------------------------------------------------

def test_effort_is_high_only_where_judgement_happens():
    high = {role for role, (effort, _v, _w) in ROLE_SETTINGS.items() if effort == "high"}
    assert high == {"lead_decide", "lead_respond", "challenger"}
    verbose = {role for role, (_e, verbosity, _w) in ROLE_SETTINGS.items() if verbosity == "high"}
    assert verbose == {"lead_decide", "lead_respond"}          # the two human-facing explanations
    assert settings_for("intake").reasoning.effort == "low"
    assert model_for("challenger", "lead-model", "cheap-model") == "cheap-model"
    rows = settings_table("lead-model", "cheap-model")
    assert {r["role"] for r in rows} == set(ROLE_SETTINGS)
    assert next(r for r in rows if r["role"] == "lead_decide")["model"] == "lead-model"


def test_run_config_names_the_workflow_per_case_and_groups_the_run():
    cfg = run_config("138", "r1700", "lead_decide", "gpt-6-astra", depth="deep")
    assert cfg.workflow_name == "pixie-case-138" and cfg.group_id == "r1700"
    assert cfg.trace_metadata["reasoning_effort"] == "high"
    assert cfg.trace_metadata["output_guardrail"] == "verify_numbers"
    assert cfg.trace_metadata["depth"] == "deep" and cfg.trace_metadata["model"] == "gpt-6-astra"


# ---------- cross-case recall ---------------------------------------------------------------------

def test_the_session_recalls_earlier_cases_and_skips_this_one(tmp_path):
    async def go():
        s = session("test-underwriter", tmp_path / "s.sqlite")
        await remember(s, "case 126; insured Lakeside Medical; broker Apex; state TX; type new")
        await remember(s, "case 138; insured Lumen Data Works; broker Apex; state FL; type new")
        return await recall(s, limit=8, skip_case="138")

    seen = asyncio.run(go())
    assert len(seen) == 1 and seen[0].startswith("case 126")


def test_recall_reaches_the_plan_prompt_but_never_the_fact_list(tmp_path, monkeypatch):
    """The boundary: recall shapes the questions, and a number in it still fails verify_numbers."""
    desk, store, run = _run(tmp_path)
    monkeypatch.setattr("atlas_api.openai_runtime.SESSION_DB", tmp_path / "s.sqlite")
    desk._sess = None

    async def go():
        await remember(desk._session(), "case 126; insured Lakeside Medical; broker Apex; state TX")
        return await desk._recall({"138": run})

    lines = asyncio.run(go())
    assert lines and lines[0].startswith("case 126")
    assert run.facts == []                                     # recall is never a computed fact
    event = next(e for e in store.tail("138") if isinstance(e.payload, RecallP))
    assert event.payload.source == "session" and event.payload.advisory is True
    assert run.checked("Lakeside Medical, case 126", "template") == ("template", False)


def test_the_memory_route_names_the_case_the_broker_and_why_it_came_back(tmp_path, monkeypatch):
    """141 after 126: the near-duplicate is recalled, and the row says why in code-computed words."""
    from fastapi.testclient import TestClient

    from atlas_api import memory as mem_mod

    monkeypatch.setenv("ATLAS_DB", str(tmp_path / "api.sqlite"))
    monkeypatch.setenv("ATLAS_OFFLINE", "1")
    session_db = tmp_path / "s.sqlite"
    monkeypatch.setattr("atlas_api.openai_runtime.SESSION_DB", session_db)
    from atlas_api.app import app
    from atlas_api.openai_runtime import remember as session_remember, session

    world = World.load()
    memo = mem_mod.memo_for(world, "126", world.case("SUB-126"))     # the line the desk itself writes
    asyncio.run(session_remember(session(db_path=session_db), memo.line()))

    with TestClient(app) as client:
        mem = client.get("/cases/141/memory").json()

    row = mem["recalled"][0]
    assert row["caseId"] == "126" and row["broker"] == memo.broker and row["insured"] == memo.insured
    assert "duplicate_account" in row["dataIssues"]
    assert "same insured" in row["why"] and "TX" in row["why"]
    assert "case 126" in mem["summary"] and memo.insured in mem["summary"]
    assert mem["source"]["lines"] == 1 and mem["source"]["needsNetwork"] is False
    assert "never supplies a number" in mem["boundary"]
    assert "$" not in mem["summary"]            # the boundary holds: no number reaches the sentence


@pytest.mark.parametrize("case_id", ["126", "138"])
def test_the_remembered_line_carries_no_money_and_no_verdict(tmp_path, case_id):
    desk, _store, run = _run(tmp_path, case_id)
    line = desk._memo(run).line()
    assert "$" not in line
    assert not any(word in line for word in ("decline", "accept", "refer", "premium", "tiv"))
    assert line.startswith(f"case {case_id}; insured ")


# ---------- the routes a judge and the web read ---------------------------------------------------

def test_local_memory_route(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("ATLAS_DB", str(tmp_path / "api.sqlite"))
    monkeypatch.setattr("atlas_api.openai_runtime.SESSION_DB", tmp_path / "s.sqlite")
    from atlas_api.app import app

    with TestClient(app) as client:
        mem = client.get("/cases/138/memory").json()
        assert mem["caseId"] == "138" and mem["session"] == [] and mem["fromLedger"] == []
        assert "never supplies a number" in mem["boundary"]
        assert client.get("/cases/9999/memory").status_code == 404

        # The read shape is a sentence, matching rows, and an explicit local source.
        assert mem["recalled"] == [] and mem["summary"].startswith("The desk has nothing to recall")
        assert mem["source"]["needsNetwork"] is False
        assert client.get("/openai/runtime").status_code == 404
        assert client.post("/cases/138/triage-message", json={"message": "any news?"}).status_code == 404
