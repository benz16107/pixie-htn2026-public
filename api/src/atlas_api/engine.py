"""The shared engine: appetite rules -> interval Assessment.

One function, `assess`, scores a Case against a RulesFile. It is pure given its inputs: risk
(region pack) and portfolio lookups are optional for now (A3's packs/us isn't built yet) and, per
AGENTS.md invariant 4, are themselves disk-cached wherever they eventually land.

    rules = RulesFile.load("rules/property_2025.yaml")
    a = assess(world.case("SUB-138"), rules)
    a.score              # ScoreInterval(lo=54.4, hi=79.4) -- premium is Missing, so it's a flipper
    a.decision            # Open(straddles=70, flippers=(Flipper(fact="premium", resolver="broker", ...),))

`estimate_premium(case, comparables)` is a standalone pure function (T7's Intake agent will call it
and fold the result into the case via `case.with_fact("premium", ..., by="intake")`, then
re-`assess()`; nothing here calls it automatically, so `assess()` always reflects the case's own
facts before any agent runs).
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import yaml

from .case import Case, Estimated, Known, Missing, Resolver, Value

Band = Literal["target", "acceptable", "not_acceptable"]
_BANDS: tuple[Band, ...] = ("target", "acceptable", "not_acceptable")
_KNOWN_PREDICATES = {"in", "eq", "between", "lte", "lt", "gte", "gt", "share_gt", "else"}
_KNOWN_FACTS = {"line", "business_type", "primary_admin", "tiv", "premium", "year_built",
                "construction_share", "loss_5yr", "water_referral", "claims_5yr"}


# ---------- rules file -----------------------------------------------------------------------------

@dataclass(frozen=True)
class Rule:
    fact: str
    bands: dict[Band, dict[str, Any]]      # insertion order = check order; first match wins
    hard_fail: bool
    route_if_not_acceptable: bool = False


@dataclass(frozen=True)
class RulesFile:
    id: str
    kind: Literal["commercial", "tenant"]
    rules: tuple[Rule, ...]
    thresholds: dict[str, float]           # {"decline": 45, "accept": 70}
    points: dict[Band, int]                # {"target": 2, "acceptable": 1, "not_acceptable": 0}
    required: dict[str, str]
    hard_fail_cap: float | None = None
    risk_points: dict[str, float] | None = None
    portfolio_points: dict[str, float] | None = None
    pricing: dict[str, Any] | None = None

    @staticmethod
    def load(path: str | Path) -> "RulesFile":
        return RulesFile.from_raw(yaml.safe_load(Path(path).read_text()), str(path))

    @staticmethod
    def from_raw(raw: dict[str, Any], path: str = "<guideline>") -> "RulesFile":
        """The same parse as load(), from an already-decoded mapping. guideline.py edits the
        mapping and rebuilds through here, so an edited guideline gets the identical checks a
        file on disk gets."""
        rules = []
        for r in raw["factors"]:
            fact = r["fact"]
            if fact not in _KNOWN_FACTS:
                raise ValueError(f"{path}: unknown fact {fact!r} (not a Case field)")
            bands: dict[Band, dict[str, Any]] = {}
            for band, pred in r["bands"].items():
                if band not in _BANDS:
                    raise ValueError(f"{path}: unknown band {band!r} on fact {fact!r}")
                unknown_ops = set(pred) - _KNOWN_PREDICATES
                if unknown_ops:
                    raise ValueError(f"{path}: unknown predicate {unknown_ops} on {fact}.{band}")
                bands[band] = pred
            rules.append(Rule(fact=fact, bands=bands, hard_fail=bool(r.get("hard_fail", False)),
                               route_if_not_acceptable=bool(r.get("route_if_not_acceptable", False))))
        return RulesFile(
            id=raw["id"], kind=raw.get("kind", "commercial"), rules=tuple(rules),
            thresholds=raw["thresholds"], points=raw["points"], required=raw.get("required", {}),
            hard_fail_cap=raw.get("hard_fail_cap"), risk_points=raw.get("risk_points"),
            portfolio_points=raw.get("portfolio_points"), pricing=raw.get("pricing"),
        )


DEFAULT_RULES_DIR = Path(__file__).resolve().parents[3] / "rules"


# ---------- factor evaluation: this is where "missing is never a pass" lives ------------------------

@dataclass(frozen=True)
class FactorResult:
    fact: str
    possible: frozenset[Band]      # one band if Known; several if Estimated/Missing span more than one
    value_text: str
    provenance: Literal["known", "estimated", "missing"]
    resolver: Resolver | None      # who could narrow this; None once it's Known


def _matches(pred: dict[str, Any], value: Any) -> bool:
    if "else" in pred:
        return True
    if "in" in pred:
        return value in pred["in"]
    if "eq" in pred:
        return value == pred["eq"]
    if "between" in pred:
        lo, hi = pred["between"]
        return lo <= value <= hi
    if "lte" in pred:
        return value <= pred["lte"]
    if "lt" in pred:
        return value < pred["lt"]
    if "gte" in pred:
        return value >= pred["gte"]
    if "gt" in pred:
        return value > pred["gt"]
    if "share_gt" in pred:
        threshold, types = pred["share_gt"]
        share = sum(value.get(t, 0.0) for t in types) if isinstance(value, dict) else 0.0
        return share > threshold
    raise ValueError(f"unrecognised predicate {pred!r}")


def _band_for(bands: dict[Band, dict[str, Any]], value: Any) -> Band:
    for band, pred in bands.items():
        if _matches(pred, value):
            return band
    return "not_acceptable"


def _fmt(v: Any) -> str:
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, (int, float)) and abs(v) >= 1000:
        return f"${v:,.0f}"
    return str(v)


def evaluate(rule: Rule, value: Value) -> FactorResult:
    """Known -> the one matching band. Estimated -> bands its lo/point/hi span (ponytail: probes
    just those three points, not every band boundary in between; correct for our factors, since
    none of Estimated's actual users -- premium, business_type -- have a band strictly between lo
    and hi that the endpoints miss. Upgrade path: probe band breakpoints too if that changes).
    Missing -> all bands, and it stays that way regardless of predicate: this is where "missing is
    never a pass" lives."""
    if isinstance(value, Known):
        band = _band_for(rule.bands, value.v)
        return FactorResult(rule.fact, frozenset({band}), f"{_fmt(value.v)} ({value.source})", "known", None)
    if isinstance(value, Estimated):
        probe_points = value.point if isinstance(value.point, dict) else None
        if probe_points is not None:
            bands = {_band_for(rule.bands, probe_points)}
        else:
            bands = {_band_for(rule.bands, p) for p in (value.lo, value.point, value.hi)}
        text = f"{_fmt(value.lo)}-{_fmt(value.hi)} est. ({value.method})"
        # Estimated facts are the intake agent's own narrowing work; "intake" is who could narrow
        # it further (case.py's Estimated carries no resolver field of its own).
        return FactorResult(rule.fact, frozenset(bands), text, "estimated", "intake")
    # Missing
    return FactorResult(rule.fact, frozenset(_BANDS), "missing", "missing", value.resolver)


# ---------- score interval, decision --------------------------------------------------------------

@dataclass(frozen=True)
class ScoreInterval:
    lo: float
    hi: float

    @property
    def mid(self) -> float:
        return (self.lo + self.hi) / 2


@dataclass(frozen=True)
class Flipper:
    fact: str
    resolver: Resolver
    bands_possible: frozenset[Band]
    value_at_stake: float


@dataclass(frozen=True)
class Decided:
    kind: Literal["accept", "refer", "decline", "approve"]
    because: tuple[str, ...]


@dataclass(frozen=True)
class Open:
    straddles: float
    flippers: tuple[Flipper, ...]


@dataclass(frozen=True)
class Routed:
    to: str
    because: str


Decision = Decided | Open | Routed


@dataclass(frozen=True)
class Contradiction:
    good: tuple[str, ...]
    bad: tuple[str, ...]
    what_would_resolve: tuple[str, ...] = ()


@dataclass(frozen=True)
class Assessment:
    case_id: str
    rules_id: str
    factors: tuple[FactorResult, ...]
    risk: Any | None                       # RiskProfile once A3's pack lands; None until then
    portfolio: Any | None                  # PortfolioImpact once Elastic/in-memory index lands
    score: ScoreInterval
    decision: Decision
    contradictions: tuple[Contradiction, ...]
    without_enrichment: ScoreInterval      # same case, pack layers off; mirrors score until packs exist


def _value_at_stake(case: Case) -> float:
    if isinstance(case.tiv, Known):
        return case.tiv.v
    if isinstance(case.tiv, Estimated):
        return case.tiv.hi
    return 0.0


def assess(case: Case, rules: RulesFile, pack: Any | None = None, portfolio: Any | None = None,
           *, enrich: bool = True) -> Assessment:
    factors: list[FactorResult] = []
    for rule in rules.rules:
        value = case.fact(rule.fact)
        fr = evaluate(rule, value)

        if rule.route_if_not_acceptable and fr.possible == frozenset({"not_acceptable"}):
            line_text = value.v if isinstance(value, Known) else str(value)
            return Assessment(
                case_id=case.id, rules_id=rules.id, factors=(fr,), risk=None, portfolio=None,
                score=ScoreInterval(0.0, 0.0),
                decision=Routed(to=f"{line_text} desk", because=f"no {rules.id} guideline for this line"),
                contradictions=(), without_enrichment=ScoreInterval(0.0, 0.0),
            )
        factors.append(fr)

    # Normalise by each factor's OWN achievable ceiling, not a blanket "target" ceiling: four of
    # the eight guideline factors (line, business_type, construction_share, loss_5yr) have no
    # `target` band at all, so 2 points is never reachable on them. Scoring them against a
    # uniform max would make 100% structurally unreachable and set the real bar far above the
    # stated accept threshold.
    total_max = sum(max(rules.points[b] for b in r.bands) for r in rules.rules)
    lo_pts = sum(min(rules.points[b] for b in f.possible) for f in factors)
    hi_pts = sum(max(rules.points[b] for b in f.possible) for f in factors)
    lo = lo_pts / total_max * 100
    hi = hi_pts / total_max * 100

    cap = rules.hard_fail_cap
    if cap is not None:
        for rule, fr in zip(rules.rules, factors):
            if not rule.hard_fail or "not_acceptable" not in fr.possible:
                continue
            if fr.provenance == "known":
                # a certain not_acceptable hard-fails outright: both ends of the interval drop
                lo, hi = min(lo, cap), min(hi, cap)
            else:
                # Estimated or Missing: widens the pessimistic case, but can never hard-fail alone
                lo = min(lo, cap)

    risk = None
    if pack is not None:
        risk = pack.profile(case.sites) if enrich else pack.profile(case.sites, layers="data_only")
        max_risk = (rules.risk_points or {}).get("max", 15)
        delta = risk_points(risk, max_risk)
        lo, hi = lo + delta, hi + delta

    portfolio_impact = None
    if portfolio is not None:
        portfolio_impact = portfolio.impact(case)
        lo, hi = lo + portfolio_impact.points, hi + portfolio_impact.points

    lo = max(0.0, min(100.0, lo))
    hi = max(lo, min(100.0, hi))
    score = ScoreInterval(lo, hi)

    decline_t, accept_t = rules.thresholds["decline"], rules.thresholds["accept"]
    if hi < decline_t:
        because = tuple(f"{f.fact}:not_acceptable" for f in factors if f.possible == frozenset({"not_acceptable"}))
        decision: Decision = Decided(kind="refer" if rules.kind == "tenant" else "decline", because=because)
    elif lo >= accept_t:
        because = tuple(f"{f.fact}:{next(iter(f.possible))}" for f in factors
                         if len(f.possible) == 1 and next(iter(f.possible)) != "not_acceptable")
        decision = Decided(kind="approve" if rules.kind == "tenant" else "accept", because=because)
    else:
        straddles = decline_t if lo < decline_t <= hi else accept_t
        value_at_stake = _value_at_stake(case)
        flippers = tuple(
            Flipper(fact=f.fact, resolver=(f.resolver or "none"), bands_possible=f.possible,
                    value_at_stake=value_at_stake)
            for f in factors if len(f.possible) > 1
        )
        decision = Open(straddles=straddles, flippers=flippers)

    good = tuple(f"{f.fact}:{next(iter(f.possible))}" for f in factors
                 if f.possible in (frozenset({"target"}), frozenset({"acceptable"})))
    bad = tuple(f"{f.fact}:not_acceptable" for f in factors if f.possible == frozenset({"not_acceptable"}))
    contradictions = (Contradiction(good=good, bad=bad),) if good and bad else ()

    return Assessment(
        case_id=case.id, rules_id=rules.id, factors=tuple(factors), risk=risk, portfolio=portfolio_impact,
        score=score, decision=decision, contradictions=contradictions,
        without_enrichment=score,  # ponytail: no pack yet to diff against; A3's pack makes this a real second pass
    )


def risk_points(risk: Any, max_points: float = 15) -> float:
    """Deterministic mapping from a RiskProfile's capped total multiplier to +/- score points."""
    import math
    total = getattr(risk, "total", 1.0)
    if total <= 0:
        return 0.0
    pts = -max_points * math.log(total) / math.log(1.25)
    return max(-max_points, min(max_points, pts))


# ---------- premium estimate: standalone, pure, cites its comparables --------------------------

def estimate_premium(case: Case, comparables: list[tuple[str, float, float]]) -> Value:
    """comparables: (policy_number, technical_premium, tiv) of bound property policies. rate =
    technical_premium/tiv; Estimated(lo=p25*tiv, hi=p75*tiv, point=median*tiv, evidence=policy
    numbers used). Needs case.tiv Known and >=5 comparables, else stays Missing(resolver='broker')."""
    if not isinstance(case.tiv, Known) or len(comparables) < 5:
        return Missing(reason="fewer than 5 bound comparables, or TIV itself unresolved", resolver="broker")
    rates = sorted(tp / tiv for _pn, tp, tiv in comparables if tiv > 0)
    if len(rates) < 5:
        return Missing(reason="fewer than 5 comparables with a usable TIV", resolver="broker")
    p25, _p50, p75 = statistics.quantiles(rates, n=4, method="inclusive")
    median = statistics.median(rates)
    tiv = case.tiv.v
    return Estimated(
        lo=round(p25 * tiv, 2), hi=round(p75 * tiv, 2), point=round(median * tiv, 2),
        method=f"p25-p75 of technical_premium/TIV over {len(comparables)} bound property comparables",
        evidence=tuple(pn for pn, _tp, _tiv in comparables),
    )


# ---------- explanations: templates use only computed numbers ------------------------------------

def explain(assessment: Assessment) -> str:
    """A template explanation built only from the factors already on the Assessment -- no LLM, so
    verify_numbers() below always passes it. T7's Lead may write a richer prose explanation later;
    this is the deterministic fallback (and the demo's default until then)."""
    d = assessment.decision
    if isinstance(d, Routed):
        return f"Routed to {d.to}: {d.because}."
    if isinstance(d, Decided):
        reasons = ", ".join(d.because) or "no single factor decided it"
        return f"{d.kind.capitalize()}: {reasons}. Score {assessment.score.lo:.0f}-{assessment.score.hi:.0f}."
    if d.flippers:
        flip_text = ", ".join(f"{f.fact} ({f.resolver})" for f in d.flippers)
        tail = f"Could flip on: {flip_text}."
    else:
        # No factor spans two bands, yet the interval still crosses the line: the width comes from
        # facts that are estimates rather than knowns. Name them instead of saying nothing would
        # resolve it, which reads as "we are stuck" when the truth is "we are guessing".
        estimated = [f.fact for f in assessment.factors if f.provenance == "estimated"]
        names = " and ".join([", ".join(estimated[:-1]), estimated[-1]] if len(estimated) > 1 else estimated)
        tail = (f"The range is this wide because {names} "
                f"{'is an estimate' if len(estimated) == 1 else 'are estimates'}, not firm figures."
                if estimated else "No single fact would resolve it.")
    return (f"Open, straddling {d.straddles:.0f}. Score {assessment.score.lo:.0f}-{assessment.score.hi:.0f}. "
            f"{tail}")


_NUMBER_RE = __import__("re").compile(r"\d[\d,]*\.?\d*")


def _bare_numbers(text: str) -> set[str]:
    return {tok.rstrip(".").replace(",", "") for tok in _NUMBER_RE.findall(text)}


def verify_numbers(text: str, assessment: Assessment) -> bool:
    """Every number token in `text` must appear in the Assessment's own computed facts (the score
    interval's bounds, the straddled threshold, a flipper's value at stake, or a factor's
    Known/Estimated value). AGENTS.md invariant 1: no number from a model ships unless code
    already computed it. A minus sign inside a range like "30-69" is not treated as a negative
    sign (bare digit groups only); genuinely negative numbers (risk points) aren't printed today."""
    allowed: set[str] = set()
    for n in (assessment.score.lo, assessment.score.hi):
        allowed |= _bare_numbers(f"{n:.0f}") | _bare_numbers(f"{n:.1f}")
    if isinstance(assessment.decision, Open):
        allowed |= _bare_numbers(f"{assessment.decision.straddles:.0f}")
        for flip in assessment.decision.flippers:
            allowed |= _bare_numbers(f"{flip.value_at_stake:.0f}")
    for f in assessment.factors:
        allowed |= _bare_numbers(f.value_text)
    return _bare_numbers(text) <= allowed


if __name__ == "__main__":
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from atlas_api.case import World

    rules = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")
    world = World.load()

    # Missing keeps every band possible
    missing_fr = evaluate(rules.rules[4], Missing(reason="x", resolver="broker"))  # premium rule
    assert missing_fr.possible == frozenset({"target", "acceptable", "not_acceptable"}), missing_fr

    # hard-fail cap: a Known not_acceptable state fully caps both ends
    a143 = assess(world.case("SUB-143"), rules)
    assert isinstance(a143.decision, Decided) and a143.decision.kind == "decline", a143.decision
    assert a143.score.hi <= rules.hard_fail_cap, a143.score

    # an Estimated value never hard-fails on its own (143's business_type is Estimated(renewal),
    # itself not_acceptable, but WA being a Known not_acceptable state is what actually decides it)
    c143 = world.case("SUB-143")
    from atlas_api.case import Estimated as _Est
    assert isinstance(c143.business_type, _Est) and c143.business_type.point == "renewal"

    # 138 stays Open on its one flipper: premium, Missing, resolver broker
    a138 = assess(world.case("SUB-138"), rules)
    assert isinstance(a138.decision, Open), a138.decision
    assert any(f.fact == "premium" and f.resolver == "broker" for f in a138.decision.flippers)

    # non-property routes
    routed = next(s for s in world.submissions.values() if s["line_of_business"] != "property")
    a_routed = assess(world.case(f"SUB-{routed['id']}"), rules)
    assert isinstance(a_routed.decision, Routed), a_routed.decision

    # explanations only use computed numbers
    for sid in (138, 143, 126, 134):
        a = assess(world.case(f"SUB-{sid}"), rules)
        text = explain(a)
        assert verify_numbers(text, a), (sid, text)

    print("engine.py self-check ok")
