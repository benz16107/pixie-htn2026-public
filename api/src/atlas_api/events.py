"""DeskEvent: the one thing agents write.

One append-only log per case is the trace, the swimlane feed, the replay and the audit. An event id
is a content hash of (case, run, actor, payload, refs), so appending the same event twice is a
no-op. `CaseFile.fold(events)` is the pure read side: what any agent sees is derived, never stored.

The JSON on the wire (`DeskEvent.wire()`) is the shape web/src/contract.ts `DeskEvent` renders:
{id, caseId, seq, tMs, actor, kind, to?, inReplyTo?, body: {text, ...}, refs}.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field

from .case import Estimated, Known, Missing, Value

Actor = Literal["lead", "intake", "appetite", "hazard", "portfolio", "challenger", "system", "human"]
Option = Literal["decline", "refer_with_subjectivity", "accept_with_subjectivity", "request_info", "route"]


class _P(BaseModel):
    text: str                                  # one line the lane card shows


class PlanP(_P):
    kind: Literal["plan"] = "plan"
    depth: Literal["skim", "standard", "deep"]
    floor: Literal["skim", "standard", "deep"]  # code's proposal; depth >= floor always
    deep_dive: bool
    dispatch: list[Actor] = []
    reason: str = ""


class QueryP(_P):
    kind: Literal["query"] = "query"
    payload: dict[str, Any]
    lint: list[str] = []
    rows: int | None = None
    ms: int | None = None
    why: str = ""


class QueryRetryP(_P):
    kind: Literal["query_retry"] = "query_retry"
    error: str
    payload: dict[str, Any]


class FindingP(_P):
    kind: Literal["finding"] = "finding"
    fact: str
    layer: str | None = None                   # hazard: which cached layer this came from
    lat: float | None = None                   # hazard: the location the map should pulse
    lng: float | None = None
    cells: list[str] = []                      # portfolio: the H3 cells it aggregated
    value: str | float | int | None = None
    provenance: Literal["known", "estimated", "missing", "external"] = "known"
    score_delta: float | None = None           # engine-computed, never model-written
    multiplier: float | None = None
    source: str = ""
    skipped: str | None = None


class EstimateP(_P):
    kind: Literal["estimate"] = "estimate"
    fact: str
    lo: float
    hi: float
    point: float
    method: str
    evidence: list[str] = []


class GapP(_P):
    kind: Literal["gap"] = "gap"
    fact: str
    reason: str
    resolver: str = "none"


class AskP(_P):
    kind: Literal["ask"] = "ask"
    to: Actor
    question: str


class AnswerP(_P):
    kind: Literal["answer"] = "answer"
    to: Actor
    in_reply_to: str
    verified: bool = True


class ConflictP(_P):
    kind: Literal["conflict"] = "conflict"
    conflict_id: str
    stances: dict[str, Literal["favour", "neutral", "against"]]
    about: list[str]
    allowed: list[Option]


class ResolutionP(_P):
    kind: Literal["resolution"] = "resolution"
    conflict_id: str
    option: Option
    reason: str
    fallback: bool = False                     # True when code picked because the Lead's choice was not allowed


class ScoreP(BaseModel):
    lo: int
    hi: int


class OverrideP(_P):
    """A human's bounded nudge of the engine's interval (docs/OVERRIDE.md). Every number here is a
    human's or the engine's, never a model's: `points` is what the underwriter dialled, the two
    intervals are the engine's before and after that adjustment."""
    kind: Literal["override"] = "override"
    points: float
    reason: str
    by: str = "underwriter"
    engine_score: ScoreP
    score: ScoreP
    decision_before: str
    decision_after: str


class GuidelineP(_P):
    """The carrier's appetite changed, and this case moved with it (docs/GUIDELINE.md).

    Every number here is the engine's: the two intervals are its re-scores of this case under the
    old and the new guideline, and `change` is what the human edited, rendered from the document
    itself rather than written by anyone."""
    kind: Literal["guideline"] = "guideline"
    guideline_id: str
    hash_before: str
    hash_after: str
    change: list[str] = []                     # the edits, in words
    by: str = "underwriting leader"
    decision_before: str
    decision_after: str
    score_before: ScoreP | None = None
    score_after: ScoreP | None = None
    factors: list[dict[str, Any]] = []         # [{fact, from: [bands], to: [bands], value}]


class AssessmentP(_P):
    kind: Literal["assessment"] = "assessment"
    score: ScoreP
    decision: str                              # accept | decline | open | routed ...
    flippers: list[str] = []


class DecisionP(_P):
    kind: Literal["decision"] = "decision"
    verdict: Option
    explanation: str
    verified: bool
    fallback: bool = False
    action: str | None = None


class RiskP(BaseModel):
    risk: str
    size: str                                  # sized from the case's own numbers, or says it cannot be
    likelihood: str                            # plain words: "likely", "possible if the broker confirms"
    remedy: str
    grounded: bool = True


class ChallengeP(_P):
    kind: Literal["challenge"] = "challenge"
    argument: str                              # the strongest case against the draft decision
    risks: list[RiskP] = []
    change_my_mind: list[str] = []             # evidence that would flip it, from the sensitivity output
    source: Literal["model", "sensitivity"] = "model"
    verified: bool = True


class ResponseP(_P):
    kind: Literal["response"] = "response"
    responses: list[dict[str, Any]] = []       # [{risk, response, accepted}] one per challenged risk
    verdict_changed: bool = False


class ActionP(_P):
    kind: Literal["action"] = "action"
    action: str
    status: Literal["proposed", "sent", "failed", "skipped"] = "proposed"
    facts: list[str] = []


class ActionResultP(_P):
    kind: Literal["action_result"] = "action_result"
    ok: bool
    detail: str = ""


class InboundP(_P):
    kind: Literal["inbound"] = "inbound"
    channel: str
    raw: dict[str, Any] = {}


class GuardrailP(_P):
    kind: Literal["guardrail"] = "guardrail"
    guardrail: str                             # "verify_numbers"
    agent: str
    tripwire: bool                             # True = the SDK raised; the output went to the fallback
    bad_tokens: list[str] = []                 # the numbers no computed fact contains
    action: str = ""


class RecallP(_P):
    kind: Literal["recall"] = "recall"
    source: str
    lines: list[str] = []
    guideline: str = ""                        # kept so old recorded runs still deserialize
    advisory: bool = True                      # recall never supplies a number or a decision tier


class JudgementP(_P):
    """Legacy recorded event shape. Current runs do not emit this payload."""

    kind: Literal["judgement"] = "judgement"
    source: str
    answers: list[dict[str, Any]] = []
    model_number: bool = True
    about: str = ""


class ToolCallP(_P):
    kind: Literal["tool_call"] = "tool_call"
    tool: str
    args: dict[str, Any] = {}
    result: Any = None
    ms: int = 0


class RunStatsP(_P):
    kind: Literal["run_stats"] = "run_stats"
    calls: int
    tokens_in: int
    tokens_out: int
    cost_usd: float
    elapsed_s: float
    phase: str = ""


class NoteP(_P):
    kind: Literal["note"] = "note"
    calls: int | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_usd: float | None = None
    ms: int | None = None


Payload = Annotated[Union[
    PlanP, QueryP, QueryRetryP, FindingP, EstimateP, GapP, AskP, AnswerP, ConflictP, ResolutionP,
    AssessmentP, DecisionP, ChallengeP, ResponseP, ActionP, ActionResultP, InboundP, GuardrailP,
    OverrideP, GuidelineP,
    RecallP, JudgementP, ToolCallP, RunStatsP, NoteP,
], Field(discriminator="kind")]

Kind = Literal["plan", "query", "query_retry", "finding", "estimate", "gap", "ask", "answer", "conflict",
               "resolution", "assessment", "challenge", "response", "decision", "action", "action_result",
               "inbound", "guardrail", "recall", "judgement", "tool_call", "run_stats", "note",
               "override", "guideline"]


class DeskEvent(BaseModel):
    id: str
    case_id: str
    run_id: str
    seq: int = 0                               # assigned by CaseStore.append
    ts: float                                  # wall clock, epoch seconds
    t_ms: int                                  # ms since the run started; replay timing
    actor: Actor
    payload: Payload
    refs: list[str] = []

    @property
    def kind(self) -> Kind:
        return self.payload.kind

    @staticmethod
    def make(case_id: str, run_id: str, actor: Actor, payload: Payload, *, t0: float,
             refs: list[str] | None = None) -> "DeskEvent":
        refs = refs or []
        body = json.dumps([case_id, run_id, actor, payload.model_dump(mode="json"), refs], sort_keys=True)
        now = time.time()
        return DeskEvent(id=hashlib.sha256(body.encode()).hexdigest()[:16], case_id=case_id, run_id=run_id,
                         ts=now, t_ms=int((now - t0) * 1000), actor=actor, payload=payload, refs=refs)

    def wire(self) -> dict[str, Any]:
        body = self.payload.model_dump(mode="json", exclude={"kind"}, exclude_none=True)
        out: dict[str, Any] = {"id": self.id, "caseId": self.case_id, "runId": self.run_id, "seq": self.seq,
                               "tMs": self.t_ms, "actor": self.actor, "kind": self.kind, "body": body,
                               "refs": self.refs}
        if isinstance(self.payload, (AskP, AnswerP)):
            out["to"] = self.payload.to
        if isinstance(self.payload, AnswerP):
            out["inReplyTo"] = self.payload.in_reply_to
        return out


# ---------- the fold: pure, derived at read time ---------------------------------------------------

@dataclass(frozen=True)
class CaseFile:
    facts: dict[str, Value]                    # facts findings/estimates added, to fold into the Case
    hazard_multipliers: dict[str, float]       # "<site>:<source>" -> applied multiplier
    last_assessment: AssessmentP | None
    open_asks: tuple[DeskEvent, ...]
    conflicts: dict[str, ConflictP]
    resolutions: dict[str, ResolutionP]
    decision: DecisionP | None
    by_actor: dict[str, int] = field(default_factory=dict)

    @staticmethod
    def fold(events: list[DeskEvent]) -> "CaseFile":
        facts: dict[str, Value] = {}
        hazard: dict[str, float] = {}
        last: AssessmentP | None = None
        asks: dict[str, DeskEvent] = {}
        answered: set[str] = set()
        conflicts: dict[str, ConflictP] = {}
        resolutions: dict[str, ResolutionP] = {}
        decision: DecisionP | None = None
        by_actor: dict[str, int] = {}
        for e in sorted(events, key=lambda e: e.seq):
            by_actor[e.actor] = by_actor.get(e.actor, 0) + 1
            p = e.payload
            if isinstance(p, EstimateP):
                facts[p.fact] = Estimated(lo=p.lo, hi=p.hi, point=p.point, method=p.method, evidence=tuple(p.evidence))
            elif isinstance(p, GapP) and p.fact not in facts:
                facts[p.fact] = Missing(reason=p.reason, resolver=p.resolver if p.resolver in (
                    "broker", "intake", "hazard", "portfolio", "applicant") else "none")
            elif isinstance(p, FindingP) and p.multiplier is not None and p.fact.startswith("hazard."):
                hazard[p.fact.removeprefix("hazard.")] = p.multiplier
            elif isinstance(p, FindingP) and p.provenance == "known" and p.value is not None and not p.fact.startswith(("hazard.", "portfolio.", "appetite.")):
                facts[p.fact] = Known(p.value, source=p.source)
            elif isinstance(p, AssessmentP):
                last = p
            elif isinstance(p, AskP):
                asks[e.id] = e
            elif isinstance(p, AnswerP):
                answered.add(p.in_reply_to)
            elif isinstance(p, ConflictP):
                conflicts[p.conflict_id] = p
            elif isinstance(p, ResolutionP):
                resolutions[p.conflict_id] = p
            elif isinstance(p, DecisionP):
                decision = p
        return CaseFile(facts=facts, hazard_multipliers=hazard, last_assessment=last,
                        open_asks=tuple(a for i, a in asks.items() if i not in answered),
                        conflicts=conflicts, resolutions=resolutions, decision=decision, by_actor=by_actor)
