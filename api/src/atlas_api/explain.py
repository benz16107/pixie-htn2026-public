"""Explainability: the same numbers the engine used, step by step. No model anywhere in this file.

    waterfall(case, a, rules, events)   # 0 -> final interval, one step per factor, layer, penalty, cap
    whatif(case, rules, overrides, ...) # recomputed interval + the override that decided it
    sensitivity(case, rules, ...)       # per unresolved fact: decision at each end, and the flip point
    surface(case, rules, axes, res)     # the same engine over a grid of 2-3 facts: the decision space

The waterfall reconciles exactly with `assess()`: `reconciles()` (and a test) asserts the last step's
running interval equals the assessment's own score.
"""

from __future__ import annotations

import itertools
import math
import time
from dataclasses import dataclass
from typing import Any, Iterable

from . import layers
from .case import Case, Estimated, Known, Missing, Value
from .engine import (Assessment, Decided, Open, Routed, Rule, RulesFile, ScoreInterval, assess,
                     evaluate, risk_points)
from .events import DeskEvent, FindingP

BAND_ORDER = ("target", "acceptable", "not_acceptable")
FACT_LABELS = {"line": "Line of business", "business_type": "Submission type", "primary_admin": "Primary state",
               "tiv": "Total insured value", "premium": "Total premium", "year_built": "Building age",
               "construction_share": "Construction", "loss_5yr": "Loss history, 5 yr"}
MONEY_FACTS = {"tiv", "premium", "loss_5yr"}


def _money(x: float) -> str:
    return f"${x:,.0f}"


def band_text(fact: str, band: str, pred: dict[str, Any]) -> str:
    """One band of one factor, in words: "target: $75,000 to $100,000". guideline.py renders the
    editable document from the same strings the waterfall cites."""
    money = fact in MONEY_FACTS

    def m(x: Any) -> str:
        return _money(x) if money else str(x)

    if "else" in pred:
        return f"{band}: anything else"
    if "between" in pred:
        lo, hi = pred["between"]
        return f"{band}: {m(lo)} to {m(hi)}"
    if "in" in pred:
        return f"{band}: {', '.join(map(str, pred['in']))}"
    if "eq" in pred:
        return f"{band}: {pred['eq']}"
    if "lte" in pred:
        return f"{band}: at most {m(pred['lte'])}"
    if "lt" in pred:
        return f"{band}: under {m(pred['lt'])}"
    if "gte" in pred:
        return f"{band}: at least {m(pred['gte'])}"
    if "gt" in pred:
        return f"{band}: after {pred['gt']}"
    if "share_gt" in pred:
        share, types = pred["share_gt"]
        return f"{band}: over {share:.0%} of TIV in {', '.join(types)}"
    return band


def rule_text(rule: Rule) -> str:
    """The guideline line this factor came from, rendered from rules/*.yaml."""
    parts = [band_text(rule.fact, band, pred) for band, pred in rule.bands.items()]
    return "; ".join(parts) + (" (hard fail)" if rule.hard_fail else "")


def _value_display(fact: str, v: Value) -> tuple[str, str, str]:
    """(display, provenance, source) for a fact, money-formatted where that is the unit."""
    money = fact in MONEY_FACTS

    def fmt(x: Any) -> str:
        if isinstance(x, dict):
            return ", ".join(f"{k} {p:.0%}" for k, p in sorted(x.items(), key=lambda kv: -kv[1]))
        if isinstance(x, (int, float)) and money:
            return _money(x)
        return str(x)

    if isinstance(v, Known):
        return fmt(v.v), "known", v.source
    if isinstance(v, Estimated):
        return f"{fmt(v.lo)} to {fmt(v.hi)} (est.)", "estimated", v.method
    return "missing", "missing", f"{v.reason}; resolver {v.resolver}"


@dataclass
class Step:
    key: str
    label: str
    band: str                 # target | acceptable | not_acceptable | unknown | (n/a for non-factor steps)
    kind: str                 # factor | cap | hazard | portfolio | clamp
    points_lo: float
    points_hi: float
    running_lo: float
    running_hi: float
    capped: bool = False
    rule: str = ""
    value: str = ""
    provenance: str = ""
    source: str = ""
    layer: str | None = None
    multiplier: float | None = None
    evidence: str = ""
    citation: str = ""
    cells: list[str] | None = None
    raw_points_lo: float | None = None
    raw_points_hi: float | None = None
    max_points: float | None = None
    multiplier_rule: str = ""

    def as_dict(self) -> dict[str, Any]:
        out = {"key": self.key, "label": self.label, "band": self.band, "kind": self.kind,
               "pointsLo": round(self.points_lo, 2), "pointsHi": round(self.points_hi, 2),
               "runningLo": round(self.running_lo, 2), "runningHi": round(self.running_hi, 2),
               "capped": self.capped, "rule": self.rule, "value": self.value,
               "provenance": self.provenance, "source": self.source}
        for name, value in (("layer", self.layer), ("multiplier", self.multiplier),
                            ("evidence", self.evidence), ("citation", self.citation), ("cells", self.cells),
                            ("rawPointsLo", self.raw_points_lo), ("rawPointsHi", self.raw_points_hi),
                            ("maxPoints", self.max_points), ("multiplierRule", self.multiplier_rule)):
            if value not in (None, "", []):
                out[name] = value
        return out


def _band_of(possible: frozenset[str]) -> str:
    if len(possible) == 1:
        return next(iter(possible))
    return "unknown"


def hazard_steps_from_events(events: Iterable[DeskEvent]) -> list[FindingP]:
    """The Hazard agent's layer findings, in the order it read them."""
    return [e.payload for e in events
            if isinstance(e.payload, FindingP) and e.payload.multiplier is not None]


def waterfall(case: Case, a: Assessment, rules: RulesFile,
              events: Iterable[DeskEvent] = (), portfolio_finding: FindingP | None = None) -> list[Step]:
    """Every point of the interval, in the order the engine applied it."""
    steps: list[Step] = []
    lo = hi = 0.0
    if isinstance(a.decision, Routed):
        return [Step(key="routed", label="Routed, not scored", band="n/a", kind="factor", points_lo=0, points_hi=0,
                     running_lo=0, running_hi=0, rule="only property has a 2025 guideline",
                     value=a.decision.to, provenance="known", source=a.decision.because)]

    total_max = sum(max(rules.points[b] for b in r.bands) for r in rules.rules)
    by_fact = {f.fact: f for f in a.factors}
    for rule in rules.rules:
        fr = by_fact.get(rule.fact) or evaluate(rule, case.fact(rule.fact))
        lo_pts = min(rules.points[b] for b in fr.possible) / total_max * 100
        hi_pts = max(rules.points[b] for b in fr.possible) / total_max * 100
        lo, hi = lo + lo_pts, hi + hi_pts
        display, provenance, source = _value_display(rule.fact, case.fact(rule.fact))
        steps.append(Step(key=rule.fact, label=FACT_LABELS.get(rule.fact, rule.fact), band=_band_of(fr.possible),
                          kind="factor", points_lo=lo_pts, points_hi=hi_pts, running_lo=lo, running_hi=hi,
                          rule=rule_text(rule), value=display, provenance=provenance, source=source,
                          raw_points_lo=min(rules.points[b] for b in fr.possible),
                          raw_points_hi=max(rules.points[b] for b in fr.possible),
                          max_points=max(rules.points[b] for b in rule.bands)))

    cap = rules.hard_fail_cap
    if cap is not None:
        for rule in rules.rules:
            fr = by_fact.get(rule.fact)
            if fr is None or not rule.hard_fail or "not_acceptable" not in fr.possible:
                continue
            before_lo, before_hi = lo, hi
            if fr.provenance == "known":
                lo, hi = min(lo, cap), min(hi, cap)
            else:
                lo = min(lo, cap)
            if (lo, hi) != (before_lo, before_hi):
                certain = "a certain" if fr.provenance == "known" else "an estimated or missing"
                steps.append(Step(
                    key=f"cap.{rule.fact}", label=f"Hard-fail cap on {FACT_LABELS.get(rule.fact, rule.fact).lower()}",
                    band=_band_of(fr.possible), kind="cap", points_lo=lo - before_lo, points_hi=hi - before_hi,
                    running_lo=lo, running_hi=hi, capped=True,
                    rule=f"{rule.fact} is a hard-fail factor: the score cannot exceed {cap:.0f} while it is "
                         f"not acceptable ({certain} fail; an estimate lowers only the pessimistic end)",
                    value=fr.value_text, provenance=fr.provenance, source="rules/property_2025.yaml hard_fail_cap"))

    max_risk = (rules.risk_points or {}).get("max", 15)
    hazard = hazard_steps_from_events(events)
    applied_total = 0.0
    for finding in hazard:
        delta = -max_risk * math.log(finding.multiplier) / math.log(1.25)
        applied_total += delta
        lo, hi = lo + delta, hi + delta
        steps.append(Step(key=finding.fact, label=f"Hazard: {finding.text.split(':')[0]}", band="n/a", kind="hazard",
                          points_lo=delta, points_hi=delta, running_lo=lo, running_hi=hi,
                          rule=f"external layer, capped multiplier; points = -{max_risk:g} x ln(multiplier) / ln(1.25)",
                          value=str(finding.value), provenance="external", source=finding.source,
                          layer=finding.layer, multiplier=finding.multiplier, evidence=finding.text,
                          citation=finding.source,
                          multiplier_rule=layers.MULTIPLIER_RULES.get(finding.layer or "", "No mapping recorded for this layer.")))
    if hazard and a.risk is not None:
        engine_total = risk_points(a.risk, max_risk)
        drift = engine_total - applied_total
        if abs(drift) > 1e-9:
            lo, hi = lo + drift, hi + drift
            steps.append(Step(key="hazard.cap", label="Hazard total clamp", band="n/a", kind="cap",
                              points_lo=drift, points_hi=drift, running_lo=lo, running_hi=hi, capped=True,
                              rule=f"the layer multipliers multiply out to {getattr(a.risk, 'total', 1):.3f}, "
                                   f"clamped to the pack's 0.85 to 1.25 range",
                              value=f"x{getattr(a.risk, 'total', 1):.3f}", provenance="external",
                              source="packs/us hazard total clamp"))

    if a.portfolio is not None:
        points = getattr(a.portfolio, "points", 0.0)
        lo, hi = lo + points, hi + points
        near = getattr(a.portfolio, "near_tiv", 0.0)
        steps.append(Step(
            key="portfolio.concentration", label="Portfolio concentration", band="n/a", kind="portfolio",
            points_lo=points, points_hi=points, running_lo=lo, running_hi=hi,
            rule=f"1 point per $25,000,000 of active property TIV within 30 km, capped at "
                 f"{(rules.portfolio_points or {}).get('max_penalty', 10)}",
            value=f"{_money(near)} within 30 km", provenance="known",
            source=(portfolio_finding.source if portfolio_finding else
                    f"exposure index ({getattr(a.portfolio, 'backend', 'memory')})"),
            cells=[getattr(a.portfolio, "cell", "")] + list(getattr(a.portfolio, "near_cells", ()))))

    clamp_lo, clamp_hi = max(0.0, min(100.0, lo)), max(0.0, min(100.0, hi))
    clamp_hi = max(clamp_lo, clamp_hi)
    if (clamp_lo, clamp_hi) != (lo, hi):
        steps.append(Step(key="clamp", label="Clamped to 0-100", band="n/a", kind="clamp",
                          points_lo=clamp_lo - lo, points_hi=clamp_hi - hi, running_lo=clamp_lo,
                          running_hi=clamp_hi, capped=True, rule="the score is a 0-100 scale",
                          value=f"{clamp_lo:.0f}-{clamp_hi:.0f}", provenance="known", source="engine.assess"))
    return steps


def reconciles(steps: list[Step], a: Assessment, tolerance: float = 1e-6) -> bool:
    """The waterfall is only worth showing if it lands exactly on the engine's own interval."""
    if not steps:
        return a.score.lo == a.score.hi == 0
    last = steps[-1]
    sum_lo = sum(s.points_lo for s in steps)
    sum_hi = sum(s.points_hi for s in steps)
    return (abs(last.running_lo - a.score.lo) < tolerance and abs(last.running_hi - a.score.hi) < tolerance
            and abs(sum_lo - a.score.lo) < tolerance and abs(sum_hi - a.score.hi) < tolerance)


def explain_payload(case: Case, a: Assessment, rules: RulesFile, events: Iterable[DeskEvent] = ()) -> dict[str, Any]:
    events = list(events)
    portfolio_finding = next((e.payload for e in events if isinstance(e.payload, FindingP)
                              and e.payload.fact == "portfolio.concentration"), None)
    steps = waterfall(case, a, rules, events, portfolio_finding)
    return {
        "caseId": case.id.removeprefix("SUB-"),
        "kind": case.kind,
        "score": None if isinstance(a.decision, Routed) else {"lo": round(a.score.lo), "hi": round(a.score.hi)},
        "decision": _decision_summary(a),
        "steps": [s.as_dict() for s in steps],
        "reconciles": reconciles(steps, a),
        "thresholds": rules.thresholds,
        "rulesId": rules.id,
        "calculation": calculation(case, a, rules, steps),
    }


def calculation(case: Case, a: Assessment, rules: RulesFile, steps: list[Step]) -> dict[str, Any] | None:
    from .portfolio import PENALTY_PER_TIV, RADIUS_KM

    if isinstance(a.decision, Routed):
        return None
    factors = [s for s in steps if s.kind == "factor"]
    caps = [s for s in steps if s.key.startswith("cap.")]
    denominator = sum(s.max_points for s in factors)
    raw_lo = sum(s.raw_points_lo for s in factors)
    raw_hi = sum(s.raw_points_hi for s in factors)
    capped = (caps or factors)[-1]
    hazard = [s for s in steps if s.kind == "hazard"]
    premium = case.fact("premium")
    premium_estimate = None
    if (isinstance(premium, Estimated) and isinstance(case.tiv, Known) and case.tiv.v > 0
            and "technical_premium/TIV" in premium.method):
        premium_estimate = {
            "tiv": case.tiv.v, "lo": premium.lo, "hi": premium.hi, "median": premium.point,
            "rateLo": premium.lo / case.tiv.v, "rateHi": premium.hi / case.tiv.v,
            "method": premium.method, "policies": list(premium.evidence),
        }
    return {
        "points": rules.points, "denominator": denominator,
        "raw": {"lo": raw_lo, "hi": raw_hi},
        "base": {"lo": raw_lo / denominator * 100, "hi": raw_hi / denominator * 100},
        "afterCaps": {"lo": capped.running_lo, "hi": capped.running_hi},
        "hardFailCap": rules.hard_fail_cap,
        "hazard": {
            "applied": a.risk is not None,
            "product": math.prod(s.multiplier for s in hazard) if hazard else None,
            "total": getattr(a.risk, "total", None), "bounds": list(layers.TOTAL_CAP),
            "maxPoints": (rules.risk_points or {}).get("max", 15),
            "points": risk_points(a.risk, (rules.risk_points or {}).get("max", 15)) if a.risk else 0,
        },
        "portfolio": {
            "applied": a.portfolio is not None,
            "points": getattr(a.portfolio, "points", 0),
            "nearTiv": getattr(a.portfolio, "near_tiv", None),
            "maxPenalty": (rules.portfolio_points or {}).get("max_penalty", 10),
            "radiusKm": RADIUS_KM, "tivPerPoint": 1 / PENALTY_PER_TIV,
        },
        "exact": {"lo": a.score.lo, "hi": a.score.hi},
        "premiumEstimate": premium_estimate,
    }


def _decision_summary(a: Assessment) -> dict[str, Any]:
    d = a.decision
    if isinstance(d, Decided):
        return {"kind": d.kind, "because": list(d.because)}
    if isinstance(d, Open):
        return {"kind": "open", "straddles": d.straddles,
                "flippers": [{"fact": f.fact, "resolver": f.resolver} for f in d.flippers]}
    return {"kind": "routed", "to": d.to, "because": d.because}


# ---------- what-if -------------------------------------------------------------------------------

NUMERIC_OVERRIDES = {"premium", "tiv", "year_built", "loss_5yr"}
TEXT_OVERRIDES = {"primary_admin": "primary_admin", "state": "primary_admin", "business_type": "business_type",
                  "line": "line"}
FLOOD_ZONE_MULTIPLIER = {"X": 1.05, "A": 1.15, "AE": 1.15, "A99": 1.15, "V": 1.20, "VE": 1.20, "NONE": 0.97}


def apply_overrides(case: Case, overrides: dict[str, Any]) -> tuple[Case, dict[str, float], list[str]]:
    """Returns the overridden case, hazard multipliers to apply, and notes about ignored keys."""
    out, hazard, notes = case, {}, []
    for key, value in overrides.items():
        if key == "hazard" and isinstance(value, dict):
            for layer_name, zone in value.items():
                if layer_name == "flood" and isinstance(zone, str):
                    hazard[f"whatif:{layer_name}"] = FLOOD_ZONE_MULTIPLIER.get(zone.upper(), 1.0)
                elif isinstance(zone, (int, float)):
                    hazard[f"whatif:{layer_name}"] = float(zone)
                else:
                    notes.append(f"hazard.{layer_name}: no curve for {zone!r}, ignored")
            continue
        if key in NUMERIC_OVERRIDES and isinstance(value, (int, float)):
            out = out.with_fact(key, Known(float(value) if key != "year_built" else float(value),
                                           source="what-if override"), by="whatif")
        elif key in TEXT_OVERRIDES and isinstance(value, str):
            out = out.with_fact(TEXT_OVERRIDES[key], Known(value, source="what-if override"), by="whatif")
        elif key == "sprinklered":
            notes.append("sprinklered is not a 2025 guideline factor; it changes no score here")
        elif key == "construction_share" and isinstance(value, dict):
            out = out.with_fact("construction_share", Known(value, source="what-if override"), by="whatif")
        else:
            notes.append(f"{key}: not an overridable fact, ignored")
    return out, hazard, notes


def _decision_kind(a: Assessment) -> str:
    d = a.decision
    return d.kind if isinstance(d, Decided) else "open" if isinstance(d, Open) else "routed"


def whatif(case: Case, rules: RulesFile, overrides: dict[str, Any], base_hazard: dict[str, float] | None = None,
           portfolio: Any | None = None) -> dict[str, Any]:
    """Pure: no store, no model, no network. The decisive override is the one that alone reproduces
    the changed decision (or, failing that, the one whose removal puts the decision back)."""
    base_hazard = dict(base_hazard or {})
    base_pack = layers.LayersPack(base_hazard) if base_hazard else None
    before = assess(case, rules, base_pack, portfolio)

    def run(ov: dict[str, Any]) -> tuple[Assessment, list[str]]:
        c, hz, notes = apply_overrides(case, ov)
        merged = {**base_hazard, **hz}
        return assess(c, rules, layers.LayersPack(merged) if merged else None, portfolio), notes

    after, notes = run(overrides)
    decisive = None
    if _decision_kind(after) != _decision_kind(before):
        for key, value in overrides.items():
            alone, _ = run({key: value})
            if _decision_kind(alone) == _decision_kind(after):
                decisive = key
                break
        if decisive is None:
            for key in overrides:
                without, _ = run({k: v for k, v in overrides.items() if k != key})
                if _decision_kind(without) == _decision_kind(before):
                    decisive = key
                    break

    before_bands = {f.fact: sorted(f.possible, key=BAND_ORDER.index) for f in before.factors}
    after_bands = {f.fact: sorted(f.possible, key=BAND_ORDER.index) for f in after.factors}
    diff = [{"fact": fact, "before": before_bands.get(fact), "after": after_bands[fact]}
            for fact in after_bands if before_bands.get(fact) != after_bands[fact]]
    return {
        "caseId": case.id.removeprefix("SUB-"),
        "before": {"score": {"lo": round(before.score.lo), "hi": round(before.score.hi)},
                   "decision": _decision_summary(before)},
        "after": {"score": {"lo": round(after.score.lo), "hi": round(after.score.hi)},
                  "decision": _decision_summary(after)},
        "changed": diff, "decisiveOverride": decisive, "notes": notes,
        "overrides": overrides,
    }


# ---------- sensitivity ---------------------------------------------------------------------------

def _probe_values(rule: Rule, money: bool) -> list[tuple[float | str, str]]:
    """Representative values for a rule's bands, and the boundary values between them."""
    out: list[tuple[float | str, str]] = []
    for band, pred in rule.bands.items():
        if "between" in pred:
            lo, hi = pred["between"]
            out += [(lo, band), (hi, band), (lo - 1, "below"), (hi + 1, "above")]
        elif "lte" in pred:
            out += [(pred["lte"], band), (pred["lte"] + 1, "above")]
        elif "lt" in pred:
            out += [(pred["lt"] - 1, band), (pred["lt"], "above")]
        elif "gte" in pred:
            out += [(pred["gte"], band), (pred["gte"] - 1, "below")]
        elif "gt" in pred:
            out += [(pred["gt"] + 1, band), (pred["gt"], "below")]
        elif "in" in pred:
            out += [(v, band) for v in pred["in"][:3]]
        elif "eq" in pred:
            out.append((pred["eq"], band))
    seen, unique = set(), []
    for value, band in out:
        if value not in seen:
            seen.add(value)
            unique.append((value, band))
    return sorted(unique, key=lambda vb: (isinstance(vb[0], str), vb[0]))


def sensitivity(case: Case, rules: RulesFile, hazard: dict[str, float] | None = None,
                portfolio: Any | None = None) -> dict[str, Any]:
    """For every unknown or estimated fact: the decision at each end of its range, and the value
    where the decision flips. Deterministic; this is what the demo slider reads."""
    pack = layers.LayersPack(hazard) if hazard else None
    base = assess(case, rules, pack, portfolio)
    base_kind = _decision_kind(base)
    rows = []
    for rule in rules.rules:
        v = case.fact(rule.fact)
        if isinstance(v, Known):
            continue
        money = rule.fact in MONEY_FACTS
        probes = _probe_values(rule, money)
        outcomes = []
        for value, _band in probes:
            probed = assess(case.with_fact(rule.fact, Known(value, source="sensitivity probe"), by="sensitivity"),
                            rules, pack, portfolio)
            outcomes.append({"value": value, "display": _money(value) if money and isinstance(value, (int, float))
                             else str(value), "decision": _decision_kind(probed),
                             "score": {"lo": round(probed.score.lo), "hi": round(probed.score.hi)}})
        kinds = {o["decision"] for o in outcomes}
        flip = None
        numeric = [o for o in outcomes if isinstance(o["value"], (int, float))]
        crossings = [(prev, cur) for prev, cur in zip(numeric, numeric[1:])
                     if cur["decision"] != prev["decision"]]
        if crossings:
            previous, current = crossings[0]
            flip = {"at": current["value"], "display": current["display"],
                    "from": previous["decision"], "to": current["decision"],
                    "text": f"{rule.fact.replace('_', ' ')} at or above {current['display']} flips "
                            f"{previous['decision']} to {current['decision']}"}
            # A guideline band has two edges: too cheap declines and so does too dear. Saying only
            # the lower edge makes the slider look broken when a judge drags it to the far end.
            if len(crossings) > 1 and crossings[1][1]["decision"] == previous["decision"]:
                upper = crossings[1][0]
                flip["until"] = upper["value"]
                flip["untilDisplay"] = upper["display"]
                flip["text"] = (f"{rule.fact.replace('_', ' ')} between {current['display']} and "
                                f"{upper['display']} makes this {current['decision']}; outside that "
                                f"band the guideline {previous['decision']}s")
        low, high = (outcomes[0], outcomes[-1]) if outcomes else ({}, {})
        rows.append({
            "fact": rule.fact, "label": FACT_LABELS.get(rule.fact, rule.fact),
            "provenance": "estimated" if isinstance(v, Estimated) else "missing",
            "resolver": v.resolver if isinstance(v, Missing) else "intake",
            "low": low, "high": high, "flip": flip, "outcomes": outcomes,
            "movesDecision": len(kinds) > 1,
            "spread": round(max((o["score"]["hi"] for o in outcomes), default=0)
                            - min((o["score"]["lo"] for o in outcomes), default=0), 1),
        })
    rows.sort(key=lambda r: (not r["movesDecision"], -r["spread"]))
    return {"caseId": case.id.removeprefix("SUB-"), "decision": base_kind,
            "score": {"lo": round(base.score.lo), "hi": round(base.score.hi)}, "facts": rows}


# ---------- decision surface: the same engine over a grid (AUDIT 4, item 2) -------------------------

# Editorial axis windows. Wide enough that every band in rules/property_2025.yaml is visible on the
# axis, tight enough that an 11-step grid still resolves the boundary between two bands. Widened at
# request time so the case's own value and its uncertainty always land inside the window.
AXIS_WINDOW: dict[str, tuple[float, float]] = {
    "premium": (0.0, 200_000.0),
    "tiv": (0.0, 180_000_000.0),
    "year_built": (1960.0, 2025.0),
    "loss_5yr": (0.0, 200_000.0),
}
DEFAULT_AXES = ("premium", "year_built", "tiv")
MAX_RESOLUTION = 21


def _axis_points(case: Case, fact: str) -> list[float]:
    """Every number on this axis the case itself already implies: its value, or its estimate's ends."""
    v = case.fact(fact)
    if isinstance(v, Known) and isinstance(v.v, (int, float)):
        return [float(v.v)]
    if isinstance(v, Estimated) and isinstance(v.lo, (int, float)):
        return [float(v.lo), float(v.point), float(v.hi)]
    return []


def _axis_values(fact: str, lo: float, hi: float, n: int, at: float | None) -> list[float]:
    """Even steps, except that the step nearest the case's own value is moved onto it. The grid then
    passes exactly through the case: its pin stands on a real column, and the third axis has a slice
    labelled with the case's real figure instead of a rounded neighbour."""
    step = (hi - lo) / (n - 1)
    values = [lo + step * i for i in range(n)]
    if fact == "year_built":
        values = [float(round(v)) for v in values]
    if at is not None and lo <= at <= hi:
        values[min(range(n), key=lambda i: abs(values[i] - at))] = float(at)
    return values


def _axis_display(fact: str, v: float) -> str:
    if fact == "year_built":
        return f"{int(round(v))}"
    return _money(v) if fact in MONEY_FACTS else f"{v:,.0f}"


def _pick_axes(case: Case, rules: RulesFile, hazard: dict[str, float] | None,
               portfolio: Any | None) -> list[str]:
    """The facts sensitivity ranks highest, numeric ones only, padded with the guideline's big three."""
    ranked = [r["fact"] for r in sensitivity(case, rules, hazard, portfolio)["facts"]
              if r["fact"] in AXIS_WINDOW]
    chosen = ranked[:3]
    for fact in DEFAULT_AXES:
        if len(chosen) == 3:
            break
        if fact not in chosen:
            chosen.append(fact)
    return chosen[:3]


def surface(case: Case, rules: RulesFile, axes: list[str] | None = None, resolution: int = 11,
            hazard: dict[str, float] | None = None, portfolio: Any | None = None) -> dict[str, Any]:
    """The decision space: `assess()` re-run over every combination of two or three fact axes.

    Pure engine. No model, no network, no store. Measured on an M2 MacBook Pro: 11 steps on three
    axes is 1,331 assessments in 56-61 ms, two axes is 4.5 ms, and 15 steps on three axes is 140 ms
    (`test_surface_is_fast_enough_to_feel_live` fails over 300 ms). The route caches per (case, desk
    run, axes, resolution), so a repeat answers in under a millisecond and the what-if slider moves
    the case across a volume that is already in memory.

    `grid` is flat and row-major over `axes`, so the point at (i, j, k) is at
    `i * n1 * n2 + j * n2 + k`. `case.at` is the case's real position, unsnapped: `t` is 0-1 along
    each axis, and `uncertainty` on an axis is the segment a missing or estimated fact could occupy.
    """
    if not 2 <= len(axes or DEFAULT_AXES) <= 3:
        raise ValueError("a decision space needs two or three axes")
    axes = list(axes or _pick_axes(case, rules, hazard, portfolio))
    unknown = [f for f in axes if f not in AXIS_WINDOW]
    if unknown:
        raise ValueError(f"not a numeric guideline fact: {', '.join(unknown)}")
    resolution = max(3, min(MAX_RESOLUTION, resolution))

    pack = layers.LayersPack(hazard) if hazard else None
    started = time.perf_counter()

    meta: list[dict[str, Any]] = []
    for fact in axes:
        lo, hi = AXIS_WINDOW[fact]
        own = _axis_points(case, fact)
        lo, hi = min([lo] + own), max([hi] + own)
        v = case.fact(fact)
        at = own[1] if len(own) == 3 else own[0] if own else None
        values = _axis_values(fact, lo, hi, resolution, at)
        # Snapping can move an end step, so re-derive the window from the steps *and* the case's own
        # numbers. Without this an estimate's low end can fall off the left of its own axis.
        lo, hi = min([values[0]] + own), max([values[-1]] + own)
        span = hi - lo or 1.0
        segment = None
        if isinstance(v, Missing):
            segment = {"lo": lo, "hi": hi, "tLo": 0.0, "tHi": 1.0,
                       "text": f"{FACT_LABELS.get(fact, fact).lower()} is missing; ask the "
                               f"{v.resolver}. Until then it could sit anywhere on this axis."}
        elif isinstance(v, Estimated) and len(own) == 3:
            segment = {"lo": own[0], "hi": own[2], "tLo": (own[0] - lo) / span, "tHi": (own[2] - lo) / span,
                       "text": f"{FACT_LABELS.get(fact, fact).lower()} is estimated at "
                               f"{_axis_display(fact, own[0])} to {_axis_display(fact, own[2])}."}
        meta.append({
            "fact": fact, "label": FACT_LABELS.get(fact, fact),
            "unit": "money" if fact in MONEY_FACTS else "year" if fact == "year_built" else "count",
            "min": lo, "max": hi, "values": values,
            "t": [(x - lo) / span for x in values],
            "ticks": [_axis_display(fact, x) for x in values],
            "at": at, "tAt": None if at is None else (at - lo) / span,
            "provenance": _value_display(fact, v)[1], "uncertainty": segment,
        })

    lo_out: list[float] = []
    hi_out: list[float] = []
    tiers: list[str] = []
    for combo in itertools.product(*(m["values"] for m in meta)):
        probed = case
        for fact, value in zip(axes, combo):
            probed = probed.with_fact(fact, Known(value, source="decision surface"), by="surface")
        a = assess(probed, rules, pack, portfolio)
        lo_out.append(round(a.score.lo, 1))
        hi_out.append(round(a.score.hi, 1))
        tiers.append(_decision_kind(a))

    base = assess(case, rules, pack, portfolio)
    elapsed = (time.perf_counter() - started) * 1000
    return {
        "caseId": case.id.removeprefix("SUB-"), "rulesId": rules.id,
        "axes": meta, "resolution": resolution, "order": "row-major over axes",
        "shape": [len(m["values"]) for m in meta],
        "grid": {"lo": lo_out, "hi": hi_out, "tier": tiers},
        "thresholds": rules.thresholds,
        "case": {"lo": round(base.score.lo, 1), "hi": round(base.score.hi, 1),
                 "tier": _decision_kind(base),
                 "t": [m["tAt"] for m in meta], "at": [m["at"] for m in meta]},
        "points": len(tiers), "ms": round(elapsed, 1), "cached": False,
    }


# ---------- tenant: the same waterfall, in dollars --------------------------------------------------

def tenant_waterfall(view: dict[str, Any], percentiles: dict[str, Any] | None = None) -> dict[str, Any]:
    """The receipt as a waterfall: base, then each capped multiplier or flat add-on, to the annual price."""
    receipt = view.get("receipt") or {}
    running = float(receipt.get("base", 0.0))
    steps = [{"key": "base", "label": "Base rate", "kind": "base", "multiplier": None,
              "dollars": round(running, 2), "runningDollars": round(running, 2), "capped": False,
              "source": "packs/toronto/pack.yaml base rate", "percentile": None}]
    for line in receipt.get("lines", []):
        dollars = float(line.get("dollars", 0.0))
        running += dollars
        key = line["label"].lower().replace(" ", "_")
        steps.append({"key": key, "label": line["label"],
                      "kind": "multiplier" if line.get("multiplier") else "flat",
                      "multiplier": line.get("multiplier"), "dollars": round(dollars, 2),
                      "runningDollars": round(running, 2), "capped": bool(line.get("capped")),
                      "source": line.get("source", ""),
                      "percentile": (percentiles or {}).get(key)})
    annual = float(receipt.get("annual", running))
    return {
        "caseId": view["caseId"], "kind": "tenant", "region": "toronto",
        "score": None, "decision": view.get("decision"),
        "steps": steps, "annual": round(annual, 2),
        "reconciles": abs(running - annual) < 0.01,
        "percentiles": percentiles or {},
        "label": receipt.get("label", ""),
    }


def toronto_percentiles(cell: str, scores: dict[str, Any]) -> dict[str, Any]:
    """Where this block sits in the city for each layer, so the UI can say '33rd percentile for break-ins'."""
    cells = scores.get("cells", {})
    row = cells.get(cell)
    if row is None:
        return {}
    fire_values = sorted(c.get("fire_station_km", 0.0) for c in cells.values())
    fire_rank = sum(1 for v in fire_values if v < row.get("fire_station_km", 0.0)) / max(1, len(fire_values))
    in_study = sum(1 for c in cells.values() if c.get("basement_flooding_study_area")) / max(1, len(cells))
    return {
        "break-ins_near_you": {"percentile": round(float(row.get("percentile", 0)) * 100, 1),
                               "text": f"this block is in the {round(float(row.get('percentile', 0)) * 100)}th "
                                       f"percentile for break-ins in Toronto",
                               "n": len(cells)},
        "fire_station_distance": {"percentile": round(fire_rank * 100, 1),
                                  "text": f"the nearest fire station is further than "
                                          f"{round(fire_rank * 100)}% of Toronto blocks",
                                  "n": len(cells)},
        "basement_flooding": {"percentile": round(in_study * 100, 1),
                              "text": f"{round(in_study * 100)}% of Toronto blocks sit in a basement "
                                      f"flooding study area",
                              "n": len(cells)},
    }
