"""Number-free cross-case context stored by Pixie's own desk session.

The risk engine never reads this module. Recall can help the planning turn notice that an insured,
broker, region, or data issue appeared before, but it cannot supply a score, price, or decision.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

BOUNDARY = (
    "Advisory only: recall may shape which questions get asked and how the desk words them. "
    "It never supplies a number or a decision. Recalled text is not added to the run's computed "
    "fact list, so the verify_numbers guardrail rejects any unsupported numerical claim."
)


@dataclass(frozen=True)
class CaseMemo:
    """The identity and issue labels the desk may remember. Money and verdicts are excluded."""

    case_id: str
    insured: str
    broker: str
    state: str
    business: str
    issues: tuple[str, ...] = ()
    perils: tuple[str, ...] = ()

    def line(self) -> str:
        bits = [
            f"case {self.case_id}",
            f"insured {self.insured}",
            f"broker {self.broker}",
            f"state {self.state}",
            f"type {self.business}",
        ]
        if self.issues:
            bits.append("data issues " + ", ".join(sorted(self.issues)))
        if self.perils:
            bits.append("perils read " + ", ".join(sorted(self.perils)))
        return "; ".join(bits)


def parse_line(line: str) -> dict[str, str]:
    """Turn one remembered line back into fields the case page can explain."""

    out: dict[str, str] = {}
    for bit in (part.strip() for part in line.split(";")):
        for key in ("data issues", "perils read", "insured", "broker", "state", "case", "type"):
            if bit.startswith(key + " "):
                out[key.replace(" ", "_")] = bit[len(key) + 1 :]
                break
    return out


def why_recalled(memo: CaseMemo, line: str) -> str:
    """Explain the match by comparing stored fields. No model writes this sentence."""

    fields = parse_line(line)
    same: list[str] = []
    if fields.get("insured") and fields["insured"] == memo.insured:
        same.append("same insured")
    if fields.get("broker") and fields["broker"] == memo.broker:
        same.append("same broker")
    if fields.get("state") and fields["state"] == memo.state:
        same.append(f"same state ({memo.state})")
    shared = {item for item in (fields.get("data_issues") or "").split(", ") if item} & set(memo.issues)
    if shared:
        same.append("same data issue: " + ", ".join(sorted(shared)))
    return ", ".join(same) or "an earlier case on this desk"


def memo_for(world: Any, case_id: str, case: Any, perils: tuple[str, ...] = ()) -> CaseMemo:
    """Build the single safe memory shape used by the desk and the read API."""

    from .case import Known

    submission = world.submissions[int(case_id)]
    return CaseMemo(
        case_id=case_id,
        insured=str(world.insureds.get(submission["insured"], {}).get("name", "?")),
        broker=str(world.brokers.get(submission.get("broker"), {}).get("name", "unknown")),
        state=str(case.primary_admin.v) if isinstance(case.primary_admin, Known) else "unknown",
        business=str(case.business_type.v) if isinstance(case.business_type, Known) else "unknown",
        issues=tuple(sorted({issue.kind for issue in case.issues})),
        perils=perils,
    )
