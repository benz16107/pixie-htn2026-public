"""Acceptance tests for the pre-registered B1-B4 evaluation."""

from __future__ import annotations

import copy
from datetime import date, timedelta

from atlas_api.case import Known, World
from atlas_api.engine import DEFAULT_RULES_DIR, RulesFile, assess
from atlas_api.federato import Snapshot

from backtest import backtest, write_backtest


def test_backtest_counts_and_preregistered_headline() -> None:
    report = backtest()
    assert report["b1"]["n"] == 27
    assert sum(tier["n"] for tier in report["b1"]["tiers"]) == 27
    assert report["b2"]["n"] == 11
    assert report["b2"]["excluded"] == 3
    assert report["b3"]["n"] == 38
    assert report["b4"]["n"] == 27
    assert report["b4"]["factors"][0] == {"factor": "premium above $175,000", "declines": 17}
    assert report["knownMisses"] == [{
        "policy": "PR-2026-1081", "tier": "accept", "premium": 58_800, "incurred": 629_200.0,
    }]


def test_two_runs_are_byte_identical(tmp_path) -> None:
    first = write_backtest(tmp_path / "first.json")
    second = write_backtest(tmp_path / "second.json")
    assert first == second


def test_own_policy_claim_cannot_leak_across_as_of() -> None:
    base = World.load().snapshot
    policy = base.records["Policy"][1081]
    submission = base.records["Submission"][policy["submission"]]
    claim_id = policy["claims"][0]
    as_of = date.fromisoformat(submission["received_date"])

    before_snapshot = Snapshot(records=copy.deepcopy(base.records), fetched_at=base.fetched_at)
    after_snapshot = Snapshot(records=copy.deepcopy(base.records), fetched_at=base.fetched_at)
    before_snapshot.records["Claim"][claim_id]["date_of_loss"] = (as_of - timedelta(days=1)).isoformat()
    after_snapshot.records["Claim"][claim_id]["date_of_loss"] = (as_of + timedelta(days=1)).isoformat()

    before = World(before_snapshot).case(f"SUB-{policy['submission']}", as_of=as_of.isoformat())
    after = World(after_snapshot).case(f"SUB-{policy['submission']}", as_of=as_of.isoformat())
    assert isinstance(before.loss_5yr, Known) and isinstance(after.loss_5yr, Known)
    assert before.loss_5yr.v == after.loss_5yr.v
    rules = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")
    assert assess(before, rules) == assess(after, rules)
