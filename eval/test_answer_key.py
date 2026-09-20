"""The answer-key evaluation must pass at 8/10 or better.

eval/answer_key.yaml is Ben's lane, hand-scored from APPETITE_GUIDELINES.txt independent of the
engine. This test loads it, maps each entry to a real case (SUB-<id> for a Federato submission id,
policy-<id> for a bound policy -- resolved via its own submission, since World only builds cases
from submissions), assesses it, and compares decisions. A mismatch is reported by id so a wrong
entry is easy to spot; the test only requires 8 of the (up to) 10 scored entries to agree, per
The evaluation bar treats a decline vs accept vs open vs routed mismatch as an answer-key miss,
not a hard failure -- the guideline's `unknown` premium bands are deliberately ambiguous).
"""

from pathlib import Path

import yaml

from atlas_api.case import World
from atlas_api.engine import DEFAULT_RULES_DIR, Decided, Open, Routed, RulesFile, assess

ANSWER_KEY = Path(__file__).parent / "answer_key.yaml"


def _case_id_for(entry_id) -> str:
    if isinstance(entry_id, str) and entry_id.startswith("policy-"):
        policy_id = int(entry_id.removeprefix("policy-"))
        world = World.load()
        policy = world.policies[policy_id]
        return f"SUB-{policy['submission']}"
    return f"SUB-{entry_id}"


def _decision_kind(assessment) -> str:
    d = assessment.decision
    if isinstance(d, Decided):
        return d.kind
    if isinstance(d, Open):
        return "open"
    if isinstance(d, Routed):
        return "routed"
    return "unknown"


def test_answer_key_agrees_on_at_least_8_of_10():
    data = yaml.safe_load(ANSWER_KEY.read_text())
    rules = RulesFile.load(DEFAULT_RULES_DIR / "property_2025.yaml")
    world = World.load()

    scored = [c for c in data["cases"] if "decision" in c]
    mismatches = []
    for entry in scored:
        case_id = _case_id_for(entry["id"])
        assessment = assess(world.case(case_id), rules)
        got = _decision_kind(assessment)
        want = entry["decision"]
        if got != want:
            mismatches.append((entry["id"], want, got))

    agree = len(scored) - len(mismatches)
    assert agree >= 8, f"only {agree}/{len(scored)} agree with the answer key; mismatches: {mismatches}"
