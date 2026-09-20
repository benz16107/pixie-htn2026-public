"""The underwriter's bounded nudge of the engine's interval (docs/OVERRIDE.md).

Dietvorst, Simmons and Massey (2018) found that people use an imperfect model far more often when
they are allowed to move its output, even by a couple of points. This file is that knob and nothing
more. It never rewrites the engine's own numbers: the adjustment sits beside them in the case view,
lands in the same DeskEvent ledger as every other decision under the `human` actor, and is refused
outright when it asks for more movement than the bound allows.
"""

from __future__ import annotations

from typing import Any

from .case_store import CaseStore
from .engine import DEFAULT_RULES_DIR, RulesFile
from .events import DeskEvent, OverrideP, ScoreP

# A product decision, not a law of nature. Dietvorst 2018 got its adoption effect with two points of
# allowed movement; five is enough to carry a case over a threshold it already sits next to, and too
# small to turn a decline into an accept on its own. One constant, one place to change it. The API
# rejects anything past it rather than clamping quietly, because a bound nobody sees is not a bound.
MAX_OVERRIDE_POINTS = 5.0


def _rules() -> RulesFile:
    from . import guideline
    return guideline.active()


def decide(lo: float, hi: float, rules: RulesFile) -> str:
    """The engine's own threshold rule (engine.assess), applied to an already-adjusted interval.

    Mirrored rather than imported because assess() scores facts, not intervals; test_override.py
    asserts this agrees with the engine on every scored case so the two cannot drift apart.
    """
    if hi < rules.thresholds["decline"]:
        return "refer" if rules.kind == "tenant" else "decline"
    if lo >= rules.thresholds["accept"]:
        return "approve" if rules.kind == "tenant" else "accept"
    return "open"


def _clamp(x: float) -> int:
    return int(round(max(0.0, min(100.0, x))))


def latest_event(store: CaseStore, case_id: str) -> DeskEvent | None:
    return next((e for e in reversed(store.tail(case_id)) if isinstance(e.payload, OverrideP)), None)


def _block(view: dict[str, Any], e: DeskEvent, rules: RulesFile) -> dict[str, Any] | None:
    """The override as the case view carries it. The engine half is read from the view being
    patched, so a later desk run moves the human's points along with the engine's interval."""
    p: OverrideP = e.payload                                    # type: ignore[assignment]
    engine_score, engine_decision = view.get("score"), view.get("decision")
    if not engine_score or not engine_decision:
        return None                                             # routed: no interval to move
    lo, hi = _clamp(engine_score["lo"] + p.points), _clamp(engine_score["hi"] + p.points)
    kind = decide(lo, hi, rules)
    return {
        "points": p.points,
        "reason": p.reason,
        "by": p.by,
        "at": e.ts,
        "bound": MAX_OVERRIDE_POINTS,
        "provenance": "human",                                  # AGENTS.md 3: this number is a human's
        "engineScore": engine_score,
        "engineDecision": engine_decision,
        "score": {"lo": lo, "hi": hi},
        "decision": {"kind": kind, "because": [f"underwriter adjusted the interval by {p.points:+g}: {p.reason}"],
                      "by": "human"},
    }


def refresh(store: CaseStore, case_id: str) -> dict[str, Any] | None:
    """Re-derive the override block on the stored CaseView and QueueRow, or drop it when the
    override events are gone (undo, /demo/reset). Safe to call on any case."""
    data = store.get_case(case_id)
    if data is None:
        return None
    e = latest_event(store, case_id)
    block = _block(data["case"], e, _rules()) if e is not None else None
    for part in ("case", "queue"):
        if block is None:
            data[part].pop("override", None)
        else:
            data[part]["override"] = block
    store.put_case(case_id, data)
    return block


def apply(store: CaseStore, case_id: str, points: float, reason: str, by: str = "underwriter") -> dict[str, Any]:
    """Validate, write the human event, return the override block. ValueError = a 400 with a reason."""
    from .event_log import append_after_run

    data = store.get_case(case_id)
    if data is None:
        raise ValueError(f"no case {case_id}")
    reason = reason.strip()
    if not reason:
        raise ValueError("an override needs a reason: it is written into the case's audit trail")
    if points != points or points in (float("inf"), float("-inf")) or points == 0:
        raise ValueError("an override moves the interval by a non-zero number of points")
    if abs(points) > MAX_OVERRIDE_POINTS:
        raise ValueError(
            f"an underwriter adjustment is capped at {MAX_OVERRIDE_POINTS:+g} points; you asked for "
            f"{points:+g}. Nothing was changed. Larger disagreements belong in the decision itself, "
            f"not in the score.")
    view = data["case"]
    if not view.get("score"):
        raise ValueError(f"case {case_id} has no scored interval to move")

    rules = _rules()
    engine = view["score"]
    lo, hi = _clamp(engine["lo"] + points), _clamp(engine["hi"] + points)
    before = view["decision"]["kind"]
    after = decide(lo, hi, rules)
    append_after_run(store, case_id, store.latest_run(case_id) or "human", "human", OverrideP(
        text=f"Underwriter adjusted the score by {points:+g}: {reason}",
        points=points, reason=reason, by=by,
        engine_score=ScoreP(lo=engine["lo"], hi=engine["hi"]), score=ScoreP(lo=lo, hi=hi),
        decision_before=before, decision_after=after))
    block = refresh(store, case_id)
    assert block is not None
    return block


def clear(store: CaseStore, case_id: str) -> int:
    """Undo: drop the override events (a mis-click at the booth) and re-derive the view."""
    removed = store.delete_events(case_id, {"override"})
    refresh(store, case_id)
    return removed


def waterfall_step(store: CaseStore, case_id: str) -> dict[str, Any] | None:
    """The override as a final waterfall step, marked `human` so the chart can set it apart from
    every engine step. Appended after `reconciles`, which still checks the engine's own steps."""
    view = (store.get_case(case_id) or {}).get("case", {})
    ov = view.get("override")
    if not ov:
        return None
    lo0, hi0 = ov["engineScore"]["lo"], ov["engineScore"]["hi"]
    lo, hi = ov["score"]["lo"], ov["score"]["hi"]
    return {
        "key": "human.override", "label": "Underwriter adjustment", "band": "n/a", "kind": "human",
        "pointsLo": round(lo - lo0, 2), "pointsHi": round(hi - hi0, 2),
        "runningLo": lo, "runningHi": hi, "capped": False,
        "rule": f"a human may move the engine's interval by at most {MAX_OVERRIDE_POINTS:+g} points, "
                f"with a reason that is logged (docs/OVERRIDE.md)",
        "value": f"{ov['points']:+g} points, {ov['reason']}",
        "provenance": "human",
        "source": f"{ov['by']}: {ov['engineDecision']['kind']} becomes {ov['decision']['kind']}",
    }
