"""Risk engine acceptance tests."""

import pytest

from atlas_api.case import Estimated, Known, Missing, World
from atlas_api.engine import (
    DEFAULT_RULES_DIR,
    Decided,
    Open,
    Routed,
    RulesFile,
    assess,
    estimate_premium,
    evaluate,
    explain,
    verify_numbers,
)


@pytest.fixture(scope="module")
def rules() -> RulesFile:
    return RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")


@pytest.fixture(scope="module")
def world() -> World:
    return World.load()


def _rule(rules: RulesFile, fact: str):
    return next(r for r in rules.rules if r.fact == fact)


def test_missing_fact_keeps_all_three_bands_possible(rules):
    premium_rule = _rule(rules, "premium")
    fr = evaluate(premium_rule, Missing(reason="open submission has no bound Policy", resolver="broker"))
    assert fr.possible == frozenset({"target", "acceptable", "not_acceptable"})
    assert fr.provenance == "missing"


def test_estimated_premium_never_hard_fails_on_its_own(rules, world):
    # a deliberately low Estimated premium (all probe points fall in not_acceptable)
    premium_rule = _rule(rules, "premium")
    low_estimate = Estimated(lo=1000, hi=2000, point=1500, method="test", evidence=("t",))
    fr = evaluate(premium_rule, low_estimate)
    assert fr.possible == frozenset({"not_acceptable"})
    assert fr.provenance == "estimated"

    # build a case whose only hard-fail factor is this low premium estimate; the hard-fail cap
    # must only ever pull lo down (widen), never clamp hi -- so it can never single-handedly force
    # a Decided(decline) the way a Known not_acceptable would.
    case = world.case("SUB-138").with_fact("premium", low_estimate, by="test")
    a = assess(case, rules)
    assert not (isinstance(a.decision, Decided) and a.decision.kind == "decline"), a.decision
    assert a.score.hi > rules.hard_fail_cap


def test_non_property_line_returns_routed(rules, world):
    cgl = next(s for s in world.submissions.values() if s["line_of_business"] == "cgl")
    a = assess(world.case(f"SUB-{cgl['id']}"), rules)
    assert isinstance(a.decision, Routed)
    assert "cgl" in a.decision.to


def test_138_is_open_with_premium_as_the_flipper(rules, world):
    a = assess(world.case("SUB-138"), rules)
    assert isinstance(a.decision, Open)
    assert any(f.fact == "premium" and f.resolver == "broker" for f in a.decision.flippers)


def test_known_not_acceptable_hard_fails_both_ends(rules, world):
    # SUB-143: WA is a Known not_acceptable primary_admin -> hard fail caps lo AND hi
    a = assess(world.case("SUB-143"), rules)
    assert isinstance(a.decision, Decided) and a.decision.kind == "decline"
    assert a.score.hi <= rules.hard_fail_cap


def test_estimate_premium_p25_p75_of_comparables(world):
    case = world.case("SUB-138")
    comparables = world.bound_comparables("property")
    assert len(comparables) >= 5
    est = estimate_premium(case, comparables)
    assert isinstance(est, Estimated)
    assert est.lo < est.point < est.hi
    assert len(est.evidence) == len(comparables)  # every comparable used is cited


def test_estimate_premium_stays_missing_under_5_comparables(world):
    case = world.case("SUB-138")
    est = estimate_premium(case, [("PR-1", 1000.0, 100000.0)] * 3)
    assert isinstance(est, Missing)
    assert est.resolver == "broker"


def test_explanations_only_use_computed_numbers(rules, world):
    for sub_id in (138, 143, 126, 134, 115):
        a = assess(world.case(f"SUB-{sub_id}"), rules)
        text = explain(a)
        assert verify_numbers(text, a), (sub_id, text)


def test_verify_numbers_rejects_a_planted_wrong_number(rules, world):
    a = assess(world.case("SUB-143"), rules)
    assert not verify_numbers("Declined: state factor scored 99999.", a)


def test_rules_file_rejects_unknown_fact_or_predicate(tmp_path):
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        "id: bad\nkind: commercial\nthresholds: {decline: 45, accept: 70}\n"
        "points: {target: 2, acceptable: 1, not_acceptable: 0}\nfactors:\n"
        "  - fact: not_a_real_fact\n    hard_fail: false\n    bands: {acceptable: {eq: x}}\n"
    )
    with pytest.raises(ValueError):
        RulesFile.load(bad)
