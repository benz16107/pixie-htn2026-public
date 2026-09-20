#!/usr/bin/env python3
"""Score the desk against eval/answer_key.yaml once per model tier: accuracy, cost, latency.

    cd api && uv run python ../eval/model_eval.py                       # all three tiers
    cd api && uv run python ../eval/model_eval.py --tiers gpt-5.6-luna  # one tier
    cd api && uv run python ../eval/model_eval.py --engine-only         # no model calls at all

Local on purpose. The comparison runs offline for every saved candidate file and does not depend on
a provider dashboard during judging. The ground truth already exists in `answer_key.yaml`,
hand-scored from APPETITE_GUIDELINES.txt independently of the engine, and the desk already produces
one verdict per case.

What the table means. The engine row is the deterministic baseline: `assess()` with no model in the
loop. Each model row runs the full six-agent desk with both the lead and the specialist roles pinned
to that tier. A model cannot invent a verdict -- `allowed_options()` computes the permitted set and
code falls back to the first option -- so what a tier changes is which allowed option gets chosen,
how deep the desk digs, what the explanation says, and what it costs. The accuracy column is
therefore a measure of judgement inside a fixed envelope, not of arithmetic.

A tier the key cannot reach (no API key, model not on the account, network down) is reported as
unavailable with the reason. It never gets an invented row.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
for path in (ROOT / "api" / "src", ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from atlas_api.case import World  # noqa: E402
from atlas_api.case_store import CaseStore  # noqa: E402
from atlas_api.desk import Desk, ModelConfig  # noqa: E402
from atlas_api.engine import DEFAULT_RULES_DIR, Decided, Open, Routed, RulesFile, assess  # noqa: E402

ANSWER_KEY = Path(__file__).parent / "answer_key.yaml"
OUTPUT = Path(__file__).parent / "model_eval.json"
TIERS = ["gpt-6-astra", "gpt-5.6-luna", "gpt-5.6-sol"]

# The desk picks a verdict from allowed_options(); the answer key names a decision tier. This is the
# one mapping between them, written down once so the score cannot quietly change shape.
VERDICT_TIER = {
    "decline": "decline",
    "accept_with_subjectivity": "accept",
    "refer_with_subjectivity": "open",      # a referral is neither a straight accept nor a decline
    "request_info": "open",
    "route": "routed",
}


@dataclass
class TierResult:
    tier: str
    available: bool = True
    reason: str = ""
    rows: list[dict[str, Any]] = field(default_factory=list)
    cost_usd: float = 0.0
    seconds: float = 0.0
    calls: int = 0

    @property
    def agreed(self) -> int:
        return sum(1 for r in self.rows if r["agrees"])

    def wire(self) -> dict[str, Any]:
        if not self.available:
            return {"tier": self.tier, "available": False, "reason": self.reason}
        n = len(self.rows)
        return {"tier": self.tier, "available": True, "n": n, "agreed": self.agreed,
                "accuracy": round(self.agreed / n, 3) if n else None,
                "costUsd": round(self.cost_usd, 4), "seconds": round(self.seconds, 1),
                "modelCalls": self.calls, "rows": self.rows}


def answer_key() -> dict[str, str]:
    """case id -> the hand-written decision tier, for the entries that name a submission."""
    data = yaml.safe_load(ANSWER_KEY.read_text())
    return {str(c["id"]): c["decision"] for c in data["cases"]
            if not str(c["id"]).startswith("policy-") and c.get("decision")}


def score(verdicts: dict[str, str], key: dict[str, str]) -> list[dict[str, Any]]:
    """One row per case: what the desk said, what the key says, and whether they agree."""
    rows = []
    for case_id, verdict in verdicts.items():
        tier = VERDICT_TIER.get(verdict, verdict)
        expected = key.get(case_id)
        rows.append({"caseId": case_id, "verdict": verdict, "tier": tier, "expected": expected,
                     "agrees": expected is not None and tier == expected})
    return sorted(rows, key=lambda r: int(r["caseId"]))


def engine_verdicts(world: World, case_ids: list[str]) -> dict[str, str]:
    """The deterministic baseline: the engine's own decision, no model anywhere."""
    rules = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")
    out = {}
    for cid in case_ids:
        d = assess(world.case(f"SUB-{cid}"), rules).decision
        out[cid] = d.kind if isinstance(d, Decided) else "open" if isinstance(d, Open) else "routed"
    return out


def check_tier(tier: str) -> str:
    """"" when the tier is usable, else the reason it is not. One cheap models.retrieve call."""
    try:
        from openai import OpenAI

        OpenAI().models.retrieve(tier)
        return ""
    except Exception as exc:
        return f"{type(exc).__name__}: {str(exc)[:160]}"


async def run_tier(tier: str, case_ids: list[str], db: Path) -> TierResult:
    reason = check_tier(tier)
    if reason:
        return TierResult(tier, available=False, reason=reason)
    world = World.load()
    store = CaseStore.open(db)
    desk = Desk(world, store, ModelConfig(tier, tier))
    t0 = time.time()
    results = await desk.run(case_ids, run_id=f"eval-{tier}-{int(t0)}")
    out = TierResult(tier, seconds=time.time() - t0,
                     cost_usd=sum(r.cost_usd for r in results.values()),
                     calls=sum(r.calls for r in results.values()))
    out.rows = score({cid: r.decision.verdict for cid, r in results.items()}, answer_key())
    return out


def table(results: list[TierResult]) -> str:
    head = f"{'tier':<16}{'cases':>6}{'agree':>7}{'accuracy':>10}{'cost $':>10}{'seconds':>9}{'calls':>7}"
    lines = [head, "-" * len(head)]
    for r in results:
        if not r.available:
            lines.append(f"{r.tier:<16}{'unavailable: ' + r.reason}")
            continue
        n = len(r.rows)
        acc = f"{r.agreed / n:.0%}" if n else "-"
        lines.append(f"{r.tier:<16}{n:>6}{r.agreed:>7}{acc:>10}{r.cost_usd:>10.4f}{r.seconds:>9.1f}{r.calls:>7}")
    return "\n".join(lines)


async def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tiers", default=",".join(TIERS), help="comma-separated model ids")
    ap.add_argument("--cases", default="", help="comma-separated case ids (default: every scored key entry)")
    ap.add_argument("--engine-only", action="store_true", help="the deterministic baseline, no model calls")
    ap.add_argument("--out", default=str(OUTPUT))
    args = ap.parse_args(argv)

    world = World.load()
    key = answer_key()
    case_ids = [c for c in (args.cases.split(",") if args.cases else sorted(key, key=int))
                if c and int(c) in world.submissions]
    if not case_ids:
        print("no cases to score")
        return 1

    baseline = TierResult("engine (no model)")
    baseline.rows = score(engine_verdicts(world, case_ids), key)
    results = [baseline]

    if not args.engine_only:
        db = Path(args.out).with_suffix(".sqlite")
        for tier in [t for t in args.tiers.split(",") if t]:
            results.append(await run_tier(tier, case_ids, db))

    print(f"\ncases: {', '.join(case_ids)}   key: eval/{ANSWER_KEY.name}\n")
    print(table(results))
    payload = {"cases": case_ids, "answerKey": f"eval/{ANSWER_KEY.name}",
               "tiers": [r.wire() for r in results]}
    Path(args.out).write_text(json.dumps(payload, indent=2) + "\n")
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
