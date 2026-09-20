"""The per-tier eval's scoring, without a model call.

`model_eval.py` itself needs the network; the part that decides whether a run agrees with the
answer key does not, so that part is tested here.
"""

from model_eval import VERDICT_TIER, answer_key, engine_verdicts, score, table, TierResult

from atlas_api.case import World


def test_every_verdict_the_desk_can_emit_maps_to_a_tier():
    from atlas_api.events import Option

    assert set(VERDICT_TIER) == set(Option.__args__)
    assert set(VERDICT_TIER.values()) <= {"accept", "decline", "open", "routed"}


def test_the_answer_key_and_the_engine_baseline_agree_on_every_scored_case():
    key, world = answer_key(), World.load()
    case_ids = [c for c in key if int(c) in world.submissions]
    rows = score(engine_verdicts(world, case_ids), key)
    assert len(rows) >= 8
    assert all(r["agrees"] for r in rows), [r for r in rows if not r["agrees"]]


def test_a_disagreement_is_reported_not_hidden():
    rows = score({"138": "decline"}, {"138": "open"})
    assert rows == [{"caseId": "138", "verdict": "decline", "tier": "decline", "expected": "open",
                     "agrees": False}]


def test_an_unavailable_tier_gets_a_reason_and_no_numbers():
    out = TierResult("gpt-9-nonexistent", available=False, reason="NotFoundError: no such model")
    assert out.wire() == {"tier": "gpt-9-nonexistent", "available": False,
                          "reason": "NotFoundError: no such model"}
    rendered = table([out])
    assert "unavailable: NotFoundError: no such model" in rendered
    assert "0.0000" not in rendered          # no invented cost, accuracy or latency
