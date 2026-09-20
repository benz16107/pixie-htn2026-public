#!/usr/bin/env python3
"""Run the pre-registered deterministic B1-B4 evaluation."""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
API_SRC = ROOT / "api" / "src"
if str(API_SRC) not in sys.path:
    sys.path.insert(0, str(API_SRC))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from atlas_api.case import OPEN_STATUSES, Known, World  # noqa: E402
from atlas_api.engine import (  # noqa: E402
    DEFAULT_RULES_DIR,
    Decided,
    Open,
    Routed,
    RulesFile,
    assess,
)
from packs.us.layers import USPack  # noqa: E402

OUTPUT = ROOT / "eval" / "backtest.json"
PREREGISTRATION = "5351f2340c0009d42e5a68c8d8eb41738f6ffa18"
REASON_TO_LANE = {
    "loss_history": {"lane": "Appetite", "factor": "loss factor"},
    "cat_exposure_aggregation": {"lane": "Portfolio", "factor": "portfolio concentration"},
    "outside_appetite": {"lane": "Appetite", "factor": "line or state"},
    "insufficient_controls": {"lane": "Intake", "factor": "controls gaps in ExposureUnit data"},
}


def _decision(assessment: Any) -> str:
    if isinstance(assessment.decision, Decided):
        return assessment.decision.kind
    if isinstance(assessment.decision, Open):
        return "open"
    if isinstance(assessment.decision, Routed):
        return "routed"
    raise TypeError(assessment.decision)


def _incurred(claim: dict[str, Any]) -> float:
    return float(sum(claim[field] for field in (
        "paid_indemnity", "paid_expense", "reserve_indemnity", "reserve_expense"
    )))


def _summary(items: list[tuple[float, float]]) -> dict[str, Any]:
    premium = round(sum(item[0] for item in items), 2)
    incurred = round(sum(item[1] for item in items), 2)
    return {
        "n": len(items), "premium": premium, "incurred": incurred,
        "lossRatio": round(incurred / premium, 3) if premium else None,
    }


def _b1(world: World, rules: RulesFile) -> dict[str, Any]:
    policies = sorted(
        (p for p in world.policies.values() if p["line_of_business"] == "property"),
        key=lambda p: p["id"],
    )
    groups: dict[str, list[tuple[float, float]]] = defaultdict(list)
    rows = []
    for policy in policies:
        case = world.case(f"SUB-{policy['submission']}", as_of=world.submissions[policy["submission"]]["received_date"])
        tier = _decision(assess(case, rules))
        incurred = sum(_incurred(claim) for claim in world.claims_by_policy.get(policy["id"], []))
        groups[tier].append((float(policy["premium"]), incurred))
        rows.append({"policy": policy["policy_number"], "tier": tier, "premium": policy["premium"],
                     "incurred": incurred})
    tiers = [{"tier": tier, **_summary(groups[tier])} for tier in ("accept", "open", "decline")]
    all_items = [item for values in groups.values() for item in values]
    return {
        "n": len(policies), "statuses": dict(sorted(Counter(p["status"] for p in policies).items())),
        "all": _summary(all_items), "tiers": tiers, "policies": rows,
    }


def _top_reason(assessment: Any) -> str | None:
    if isinstance(assessment.decision, Routed):
        return "outside_appetite"
    bad = {factor.fact for factor in assessment.factors if factor.possible == frozenset({"not_acceptable"})}
    if "loss_5yr" in bad:
        return "loss_history"
    if "line" in bad or "primary_admin" in bad:
        return "outside_appetite"
    return None


def _b2(world: World, rules: RulesFile) -> dict[str, Any]:
    declined = sorted(
        (s for s in world.submissions.values() if s["status"] == "declined"), key=lambda s: s["id"]
    )
    excluded = [s for s in declined if s.get("decline_reason") == "broker_withdrew"]
    included = [s for s in declined if s.get("decline_reason") in REASON_TO_LANE]
    cases = []
    for submission in included:
        assessment = assess(world.case(f"SUB-{submission['id']}", as_of=submission["received_date"]), rules)
        decision = _decision(assessment)
        top_reason = _top_reason(assessment)
        human_reason = submission["decline_reason"]
        also_declines = decision == "decline"
        cases.append({
            "caseId": str(submission["id"]), "line": submission["line_of_business"],
            "humanReason": human_reason, "deskDecision": decision, "deskTopReason": top_reason,
            "lane": REASON_TO_LANE[human_reason]["lane"], "alsoDeclines": also_declines,
            "matchingReason": also_declines and top_reason == human_reason,
        })
    grouped = []
    for reason, mapping in REASON_TO_LANE.items():
        matching = [case for case in cases if case["humanReason"] == reason]
        grouped.append({
            "reason": reason, "n": len(matching),
            "lines": dict(sorted(Counter(case["line"] for case in matching).items())),
            "lane": mapping["lane"], "factor": mapping["factor"], "excluded": False,
            "deskAgrees": sum(case["matchingReason"] for case in matching),
        })
    grouped.append({
        "reason": "broker_withdrew", "n": len(excluded),
        "lines": dict(sorted(Counter(s["line_of_business"] for s in excluded).items())),
        "lane": None, "factor": None, "excluded": True, "deskAgrees": None,
    })
    return {
        "n": len(included), "excluded": len(excluded), "deskDeclines": sum(c["alsoDeclines"] for c in cases),
        "matchingReason": sum(c["matchingReason"] for c in cases), "rows": grouped, "cases": cases,
    }


def _b3(world: World, rules: RulesFile) -> dict[str, Any]:
    """Enrichment effect. `changed` (tier changes) is the pre-registered metric; the interval, rank and
    top-mover sub-metrics were added after the first run, when `changed` came back 0 (see BACKTEST.md)."""
    pack = USPack()
    submissions = sorted(
        (s for s in world.submissions.values() if s["line_of_business"] == "property"), key=lambda s: s["id"]
    )
    changed, rows = [], []
    for submission in submissions:
        case = world.case(f"SUB-{submission['id']}", as_of=submission["received_date"])
        without = assess(case, rules, pack=pack, enrich=False)
        with_layers = assess(case, rules, pack=pack, enrich=True)
        before, after = _decision(without), _decision(with_layers)
        factors = sorted(with_layers.risk.factors, key=lambda factor: (-abs(factor.applied - 1), factor.peril))
        top = factors[0] if factors else None
        rows.append({
            "caseId": str(submission["id"]), "status": submission["status"],
            "valueAtStake": case.tiv.v if isinstance(case.tiv, Known) else 0.0,
            "without": {"lo": round(without.score.lo, 1), "hi": round(without.score.hi, 1)},
            "with": {"lo": round(with_layers.score.lo, 1), "hi": round(with_layers.score.hi, 1)},
            "midpointMove": round(with_layers.score.mid - without.score.mid, 1),
            "tierBefore": before, "tierAfter": after,
            "hardFailCapped": bool(rules.hard_fail_cap is not None and without.score.hi <= rules.hard_fail_cap),
            "topFactor": top.peril if top else None,
            "topMultiplier": round(top.applied, 3) if top else None,
        })
        if before != after:
            changed.append({"caseId": str(submission["id"]), "without": before, "with": after,
                             "factor": top.peril if top else None,
                             "multiplier": round(top.applied, 3) if top else None})

    moved = [r for r in rows if r["midpointMove"] != 0]
    sizes = sorted(abs(r["midpointMove"]) for r in moved)
    median_move = round(sizes[len(sizes) // 2] if len(sizes) % 2 else
                        (sizes[len(sizes) // 2 - 1] + sizes[len(sizes) // 2]) / 2, 1) if sizes else 0.0

    # Rank movement in the open queue: the same ordering /queue uses (interval midpoint, then value at stake).
    queue = [r for r in rows if r["status"] in OPEN_STATUSES]

    def ranked(key: str) -> dict[str, int]:
        order = sorted(queue, key=lambda r: (-(r[key]["lo"] + r[key]["hi"]) / 2, -r["valueAtStake"]))
        return {r["caseId"]: i + 1 for i, r in enumerate(order)}

    before_rank, after_rank = ranked("without"), ranked("with")
    rank_moves = [{"caseId": cid, "from": before_rank[cid], "to": after_rank[cid],
                    "places": after_rank[cid] - before_rank[cid]}
                   for cid in before_rank if before_rank[cid] != after_rank[cid]]
    def movers(pool: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [{"caseId": r["caseId"], "without": r["without"], "with": r["with"], "status": r["status"],
                  "midpointMove": r["midpointMove"], "factor": r["topFactor"], "multiplier": r["topMultiplier"],
                  "hardFailCapped": r["hardFailCapped"]}
                 for r in sorted(pool, key=lambda r: -abs(r["midpointMove"]))[:3]]

    top_movers = movers(moved)
    top_open = movers([r for r in moved if r["status"] in OPEN_STATUSES])

    return {
        "n": len(submissions), "changed": len(changed), "cases": changed,
        "changedNote": ("no decision tier changed: the property declines are structural hard fails (state, age, "
                         "loss history), which external layers cannot move"),
        "intervalMoved": len(moved), "medianAbsMidpointMove": median_move,
        "rankChanged": len(rank_moves), "rankQueueN": len(queue), "rankMoves": rank_moves,
        "topMovers": top_movers, "topMoversOpenQueue": top_open, "rows": rows,
        "addedAfterFirstRun": ["intervalMoved", "medianAbsMidpointMove", "rankChanged", "rankMoves", "topMovers",
                                 "topMoversOpenQueue"],
    }


def _b4(world: World, rules: RulesFile) -> dict[str, Any]:
    policies = sorted(
        (p for p in world.policies.values() if p["line_of_business"] == "property"), key=lambda p: p["id"]
    )
    counts: Counter[str] = Counter()
    for policy in policies:
        case = world.case(f"SUB-{policy['submission']}", as_of=world.submissions[policy["submission"]]["received_date"])
        assessment = assess(case, rules)
        for factor in assessment.factors:
            if factor.possible == frozenset({"not_acceptable"}):
                counts[factor.fact] += 1
    factors = [
        {"factor": "premium above $175,000", "declines": sum(float(p["premium"]) > 175_000 for p in policies)},
        {"factor": "premium below $50,000", "declines": sum(float(p["premium"]) < 50_000 for p in policies)},
        {"factor": "state outside 2025 list", "declines": counts["primary_admin"]},
        {"factor": "TIV above $150,000,000", "declines": counts["tiv"]},
        {"factor": "building age", "declines": counts["year_built"]},
        {"factor": "construction", "declines": counts["construction_share"]},
        {"factor": "prior loss history", "declines": counts["loss_5yr"]},
        {"factor": "renewal business", "declines": counts["business_type"]},
    ]
    return {"n": len(policies), "factors": factors}


def backtest(world: World | None = None) -> dict[str, Any]:
    world = world or World.load()
    rules = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")
    report = {
        "preregistration": PREREGISTRATION,
        "b1": _b1(world, rules), "b2": _b2(world, rules), "b3": _b3(world, rules), "b4": _b4(world, rules),
    }
    # The known miss is computed from the B1 policy row, not copied from the pre-registration prose.
    miss = next(row for row in report["b1"]["policies"] if row["policy"] == "PR-2026-1081")
    report["knownMisses"] = [miss]
    return report


def write_backtest(path: Path = OUTPUT) -> bytes:
    payload = (json.dumps(backtest(), indent=2, sort_keys=True) + "\n").encode()
    path.write_bytes(payload)
    return payload


def _write_backtest_monitored() -> bytes:
    """The nightly/precompute job (docs/research/sentry.md item 8): re-run the pre-registered
    backtest and refresh eval/backtest.json, the /backtest endpoint's source. Wrapped in a Sentry
    cron check-in so a missed or overrun run shows up as a Sentry issue; see docs/SENTRY.md for
    the OS-level schedule this still needs (the check-in alone does not schedule anything)."""
    from atlas_api import app as _app  # noqa: F401  Sentry init when SENTRY_DSN_API is set
    import sentry_sdk.crons as crons

    monitor_config = {"schedule": {"type": "crontab", "value": "0 3 * * *"}, "checkin_margin": 10,
                      "max_runtime": 10, "timezone": "UTC"}

    @crons.monitor(monitor_slug="pixie-backtest", monitor_config=monitor_config)
    def _run() -> bytes:
        return write_backtest()

    return _run()


if __name__ == "__main__":
    data = _write_backtest_monitored()
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({len(data)} bytes)")
