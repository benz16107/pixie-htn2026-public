"""AUDIT 3.1: the waterfall must reconcile with the engine, and what-if must stay pure and fast."""

import time

import pytest

from atlas_api.case import Known, World
from atlas_api.engine import DEFAULT_RULES_DIR, RulesFile, assess, estimate_premium
from atlas_api.explain import (explain_payload, reconciles, sensitivity, surface, tenant_waterfall,
                               toronto_percentiles, waterfall, whatif)
from atlas_api.layers import LayersPack

RULES = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")


@pytest.fixture(scope="module")
def world() -> World:
    return World.load()


@pytest.mark.parametrize("case_id", ["138", "126", "143", "133", "134"])
def test_waterfall_sums_exactly_to_the_interval(world, case_id):
    case = world.case(f"SUB-{case_id}")
    hazard = {"1:fema_flood": 1.15, "1:usgs_earthquakes": 1.03}
    a = assess(case, RULES, LayersPack(hazard))
    steps = waterfall(case, a, RULES, _hazard_events(case_id, hazard))
    assert reconciles(steps, a)
    assert abs(sum(s.points_lo for s in steps) - a.score.lo) < 1e-6
    assert abs(steps[-1].running_hi - a.score.hi) < 1e-6
    assert any(s.kind == "factor" and s.rule for s in steps)


def _hazard_events(case_id, multipliers):
    import time as _t

    from atlas_api.events import DeskEvent, FindingP
    return [DeskEvent.make(case_id, "t", "hazard",
                            FindingP(text=f"flood: x{m}", fact=f"hazard.{k}", multiplier=m, provenance="external",
                                     score_delta=0.0, source="test", layer=k.split(":")[1]), t0=_t.time())
            for k, m in multipliers.items()]


def test_cap_step_is_explicit_and_labelled(world):
    case = world.case("SUB-143")          # WA: a known hard fail, so the cap bites on both ends
    a = assess(case, RULES)
    steps = waterfall(case, a, RULES)
    caps = [s for s in steps if s.kind == "cap"]
    assert caps and all(s.capped for s in caps)
    assert "hard-fail" in caps[0].rule and reconciles(steps, a)


@pytest.mark.parametrize("case_id", ["138", "126", "143"])
def test_calculation_equation_reproduces_engine_with_capped_hazards(world, case_id):
    import math
    from atlas_api.portfolio import InMemoryIndex

    case = world.case(f"SUB-{case_id}")
    multipliers = {"1:fema_flood": 1.20, "1:usgs_earthquakes": 1.10}
    index = InMemoryIndex(world)
    a = assess(case, RULES, LayersPack(multipliers), index)
    payload = explain_payload(case, a, RULES, _hazard_events(case_id, multipliers))
    c = payload["calculation"]
    assert payload["reconciles"]
    assert c["denominator"] == 12
    assert c["hazard"]["product"] == pytest.approx(1.32)
    assert c["hazard"]["total"] == 1.25
    assert c["hazard"]["points"] == -15
    for end in ("lo", "hi"):
        assert c["base"][end] == pytest.approx(100 * c["raw"][end] / c["denominator"])
        final = max(0, min(100, c["afterCaps"][end] + c["hazard"]["points"] + c["portfolio"]["points"]))
        assert final == pytest.approx(c["exact"][end])
        assert math.isfinite(final)
    factors = [s for s in payload["steps"] if s["kind"] == "factor"]
    assert all("rawPointsLo" in s and "rawPointsHi" in s and "maxPoints" in s for s in factors)
    assert all(s["multiplierRule"] != "No mapping recorded for this layer."
               for s in payload["steps"] if s["kind"] == "hazard")


def test_calculation_explains_comparable_premium_without_claiming_confirmed_value(world):
    case = world.case("SUB-138")
    comparables = [(f"P{i}", 1000 * i, 1_000_000) for i in range(1, 8)]
    estimate = estimate_premium(case, comparables)
    case = case.with_fact("premium", estimate, by="intake")
    payload = explain_payload(case, assess(case, RULES), RULES)
    premium = payload["calculation"]["premiumEstimate"]
    assert premium["rateLo"] * premium["tiv"] == pytest.approx(estimate.lo)
    assert premium["rateHi"] * premium["tiv"] == pytest.approx(estimate.hi)
    assert premium["policies"] == [f"P{i}" for i in range(1, 8)]
    assert next(s for s in payload["steps"] if s["key"] == "premium")["provenance"] == "estimated"


def test_routed_submission_has_no_calculation(world):
    case = world.case("SUB-138").with_fact("line", Known("auto", source="test"), by="test")
    payload = explain_payload(case, assess(case, RULES), RULES)
    assert payload["score"] is None and payload["calculation"] is None


def test_whatif_is_pure_and_fast(world):
    case = world.case("SUB-138")
    before = assess(case, RULES).decision
    t0 = time.perf_counter()
    out = whatif(case, RULES, {"premium": 80_000, "sprinklered": True})
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert elapsed_ms < 50
    assert out["after"]["decision"]["kind"] == "accept" and out["decisiveOverride"] == "premium"
    premium_change = next(c for c in out["changed"] if c["fact"] == "premium")
    assert premium_change["after"] == ["target"] and "not_acceptable" in premium_change["before"]
    assert any("sprinklered" in n for n in out["notes"])
    assert assess(case, RULES).decision == before        # the case itself is untouched


def test_sensitivity_names_the_flip_point(world):
    case = world.case("SUB-138")
    out = sensitivity(case, RULES)
    premium = next(r for r in out["facts"] if r["fact"] == "premium")
    assert premium["movesDecision"] and premium["flip"]["at"] == 50_000
    # The guideline is a band, so the text names both edges, not just the lower crossing.
    assert premium["flip"]["until"] == 175_000
    assert "between $50,000 and $175,000" in premium["flip"]["text"]
    assert out["facts"][0]["spread"] >= out["facts"][-1]["spread"]     # ranked by how much it moves



def test_tenant_waterfall_reconciles_with_the_receipt():
    view = {"caseId": "TQ-test", "decision": {"kind": "approve"},
            "facts": [{"id": "hex", "display": "892b986cb0bffff"}],
            "receipt": {"base": 100.0, "annual": 115.5, "label": "Illustrative.",
                        "lines": [{"label": "Break-ins near you", "multiplier": 1.05, "dollars": 5.0,
                                   "capped": False, "source": "TPS"},
                                  {"label": "Sewer backup add-on", "dollars": 10.5, "capped": False,
                                   "source": "answer"}]}}
    out = tenant_waterfall(view, {})
    assert out["reconciles"] and out["steps"][-1]["runningDollars"] == 115.5
    assert out["steps"][0]["kind"] == "base" and out["steps"][2]["kind"] == "flat"


def test_toronto_percentiles_read_the_pack():
    import json
    from pathlib import Path
    scores_path = Path(__file__).resolve().parents[2] / "packs" / "toronto" / "hex_scores.json"
    scores = json.loads(scores_path.read_text())
    cell = next(iter(scores["cells"]))
    out = toronto_percentiles(cell, scores)
    assert 0 <= out["break-ins_near_you"]["percentile"] <= 100
    assert "percentile for break-ins" in out["break-ins_near_you"]["text"]
    assert toronto_percentiles("not-a-cell", scores) == {}


# ---------- the decision surface (AUDIT 4, item 2) -------------------------------------------------

def test_surface_grid_reconciles_with_the_engine(world):
    """Every grid point must be the engine's own answer for that combination of facts, not a fit."""
    case = world.case("SUB-138")
    out = surface(case, RULES, ["premium", "year_built"], 5)
    assert out["shape"] == [5, 5] and out["points"] == 25
    for i, premium in enumerate(out["axes"][0]["values"]):
        for j, year in enumerate(out["axes"][1]["values"]):
            probed = assess(case.with_fact("premium", Known(premium, source="t"), by="t")
                                .with_fact("year_built", Known(year, source="t"), by="t"), RULES)
            n = i * 5 + j
            assert out["grid"]["lo"][n] == round(probed.score.lo, 1)
            assert out["grid"]["hi"][n] == round(probed.score.hi, 1)
    assert set(out["grid"]["tier"]) <= {"accept", "refer", "decline", "open", "routed"}


def test_surface_places_the_case_and_its_uncertainty(world):
    """138's premium is Missing, so its segment covers the whole axis; its year is Known, so the
    grid is snapped onto it and the case's own position is exact."""
    out = surface(world.case("SUB-138"), RULES, ["premium", "year_built", "tiv"], 7)
    premium, year, tiv = out["axes"]
    assert premium["at"] is None and premium["uncertainty"]["tLo"] == 0.0 and premium["uncertainty"]["tHi"] == 1.0
    assert "ask the broker" in premium["uncertainty"]["text"]
    assert year["at"] == 2023 and year["at"] in year["values"] and year["uncertainty"] is None
    assert tiv["at"] in tiv["values"]
    assert out["case"]["tier"] == "open" and out["case"]["t"][1] == pytest.approx(1.0)


def test_surface_is_fast_enough_to_feel_live(world):
    """1,331 assessments. 56-61 ms measured; the bar is 300 ms, above which a slider stops feeling live."""
    case = world.case("SUB-138")
    surface(case, RULES, None, 11)                       # warm the snapshot reads
    t0 = time.perf_counter()
    out = surface(case, RULES, None, 11, {"1:fema_flood": 1.15}, None)
    assert (time.perf_counter() - t0) * 1000 < 300, out["ms"]
    assert out["points"] == 1331 and [a["fact"] for a in out["axes"]] == ["premium", "year_built", "tiv"]


def test_surface_rejects_axes_it_cannot_score(world):
    with pytest.raises(ValueError):
        surface(world.case("SUB-138"), RULES, ["premium", "primary_admin"], 5)
    with pytest.raises(ValueError):
        surface(world.case("SUB-138"), RULES, ["premium"], 5)
