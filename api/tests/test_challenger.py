"""AUDIT 3.2: the Challenger, and the gate that stops a decision from skipping it."""

import time

from atlas_api.case import World
from atlas_api.case_store import CaseStore
from atlas_api.desk import Desk, ModelConfig
from atlas_api.engine import DEFAULT_RULES_DIR, RulesFile
from atlas_api.events import CaseFile, ChallengeP, DeskEvent, ResponseP, RiskP
from atlas_api.explain import sensitivity

RULES = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")


def _run(tmp_path, case_id: str):
    world = World.load()
    store = CaseStore.open(tmp_path / "c.sqlite")
    desk = Desk(world, store, ModelConfig("none", "none"))
    case = world.case(f"SUB-{case_id}")
    from atlas_api.desk import _CaseRun
    from atlas_api.engine import assess
    return desk, store, _CaseRun(desk, case_id, case, assess(case, RULES), "rtest", time.time())


def test_skim_cases_get_a_challenge_with_no_model_call(tmp_path):
    desk, store, run = _run(tmp_path, "133")          # decided decline, no deep dive
    result = desk._template_decision(run)
    kinds = [e.kind for e in store.tail("133")]
    assert kinds.index("challenge") < kinds.index("decision")     # challenged before deciding
    assert kinds.index("response") < kinds.index("decision")
    challenge = next(e.payload for e in store.tail("133") if isinstance(e.payload, ChallengeP))
    assert challenge.source == "sensitivity" and run.calls == 0 and result.cost_usd == 0.0
    assert challenge.argument and all(r.grounded for r in challenge.risks)


def test_every_challenged_risk_is_answered_before_the_decision(tmp_path):
    desk, store, run = _run(tmp_path, "138")
    run.post("challenger", ChallengeP(text="t", argument="a", source="model", risks=[
        RiskP(risk="unanswered risk", size="cannot be sized from the case's own numbers",
              likelihood="possible", remedy="ask the broker")]))
    desk._gate_on_challenge(run)
    responses = [x["risk"] for e in store.tail("138") if isinstance(e.payload, ResponseP)
                 for x in e.payload.responses]
    assert responses == ["unanswered risk"]
    assert all(not x["accepted"] for e in store.tail("138") if isinstance(e.payload, ResponseP)
               for x in e.payload.responses)
    desk._gate_on_challenge(run)                        # idempotent: nothing left unanswered
    assert sum(1 for e in store.tail("138") if isinstance(e.payload, ResponseP)) == 1


def test_deterministic_challenge_is_grounded_in_the_sensitivity_output(tmp_path):
    desk, store, run = _run(tmp_path, "138")
    sens = sensitivity(run.case, RULES)
    verdict, explanation, challenge_id = desk._deterministic_challenge(run, "request_info", "draft", sens)
    challenge = next(e.payload for e in store.tail("138") if isinstance(e.payload, ChallengeP))
    assert verdict == "request_info" and challenge_id
    assert any("premium" in r.risk.lower() for r in challenge.risks)
    assert any("premium" in m and "$50,000" in m for m in challenge.change_my_mind)
    fold = CaseFile.fold(store.tail("138"))
    assert fold.decision is None                        # a challenge alone is not a decision
