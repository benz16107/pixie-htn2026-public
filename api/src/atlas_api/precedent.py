"""Precedent index: past submissions (bound and declined) as searchable book history.

    pixie-precedent  one doc per bound policy or declined submission: a written `summary`
                     (semantic_text -> Jina dense embedding), keyword facets for filtering and
                     significant_terms (line, state, construction, broker, perils, decision), and
                     the real outcome (premium, incurred losses). Loaded by
                     scripts/load_precedent.py.

Two jobs, one index:
  PrecedentIndex.search(case)               hybrid rrf(BM25 + semantic) wrapped in a
                                             text_similarity_reranker -- the 3 nearest past risks
                                             and what happened, for the desk and /cases/{id}/precedent.
  PrecedentIndex.declines_significant_terms()  significant_terms over declined / loss-making docs
                                             vs. the whole book -- /insights/declines.
  PrecedentIndex.percentile_rank(tiv, premium)  percentile_ranks agg against the bound book.

Every method tries Elastic first and falls back to the same math run in memory over the same doc
set if the project is unreachable (AGENTS.md invariant 4: the demo never blanks out). `backend` on
every result says which one answered, same convention as portfolio.ExposureIndex.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

from .case import Case, Estimated, Known, World
from .maps import PERIL_TAGS
from .portfolio import _elastic_client

PRECEDENT_INDEX = "pixie-precedent"
RERANKER_MODEL = ".jina-reranker-v3"


def _money(x: float) -> str:
    return f"${x:,.0f}"


def _tiv_band(tiv: float) -> str:
    for edge, name in ((5e6, "under $5M"), (2e7, "$5M-$20M"), (5e7, "$20M-$50M"), (1e8, "$50M-$100M")):
        if tiv < edge:
            return name
    return "over $100M"


def _perils(tags: tuple[str, ...]) -> list[str]:
    tagset = set(tags)
    return sorted(p for p, group in PERIL_TAGS.items() if group & tagset)


def _dominant_construction(case: Case) -> str:
    share = case.construction_share
    return max(share.v.items(), key=lambda kv: kv[1])[0] if isinstance(share, Known) and share.v else "unknown"


def _case_state(case: Case) -> str:
    return case.primary_admin.v if isinstance(case.primary_admin, Known) else "?"


def _case_tiv(case: Case) -> float:
    if isinstance(case.tiv, Known):
        return case.tiv.v
    if isinstance(case.tiv, Estimated):
        return case.tiv.point
    return 0.0


# ---------- doc building: every bound policy, every declined submission ----------------------------

def build_precedent_docs(world: World) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []

    for policy in world.policies.values():
        sub_id = policy.get("submission")
        if sub_id is None or sub_id not in world.submissions:
            continue
        sub = world.submissions[sub_id]
        case = world.case(f"SUB-{sub_id}", as_of=sub["received_date"])
        tiv = _case_tiv(case)
        premium = float(policy["premium"])
        incurred = sum(c["paid_indemnity"] + c["paid_expense"] + c["reserve_indemnity"] + c["reserve_expense"]
                       for c in world.claims_by_policy.get(policy["id"], []))
        construction = _dominant_construction(case)
        state = _case_state(case)
        perils = _perils(tuple(t for s in case.sites for t in s.tags))
        broker = world.brokers.get(sub["broker"], {}).get("name", "unknown")
        summary = (f"Bound {policy['line_of_business']} policy in {state}, {construction} construction, "
                   f"TIV {_money(tiv)}, premium {_money(premium)}, perils {', '.join(perils) or 'none tagged'}, "
                   f"placed through {broker}. " +
                   (f"{_money(incurred)} incurred in losses since bound." if incurred > 0
                    else "No claims on file since bound."))
        docs.append({
            "id": policy["policy_number"], "policyNumber": policy["policy_number"], "caseId": str(sub_id),
            "insured": world.insureds.get(policy["insured"], {}).get("name", "?"),
            "line": policy["line_of_business"], "state": state, "construction": construction,
            "broker": broker, "decision": "bound", "declineReason": None,
            "tiv": tiv, "tivBand": _tiv_band(tiv), "premium": premium,
            "perils": perils, "status": policy["status"], "incurred": float(incurred),
            "lossRatio": round(incurred / premium, 4) if premium else None,
            "summary": summary,
        })

    for sub in world.submissions.values():
        if sub["status"] != "declined":
            continue
        case = world.case(f"SUB-{sub['id']}")
        tiv = _case_tiv(case)
        construction = _dominant_construction(case)
        state = _case_state(case)
        perils = _perils(tuple(t for s in case.sites for t in s.tags))
        broker = world.brokers.get(sub["broker"], {}).get("name", "unknown")
        reason = sub["decline_reason"] or "unspecified"
        summary = (f"Declined {sub['line_of_business']} submission in {state}, {construction} construction, "
                   f"TIV {_money(tiv)}, perils {', '.join(perils) or 'none tagged'}, "
                   f"placed through {broker}. Declined: {reason}.")
        docs.append({
            "id": sub["submission_number"], "policyNumber": None, "caseId": str(sub["id"]),
            "insured": world.insureds.get(sub["insured"], {}).get("name", "?"),
            "line": sub["line_of_business"], "state": state, "construction": construction,
            "broker": broker, "decision": "declined", "declineReason": reason,
            "tiv": tiv, "tivBand": _tiv_band(tiv), "premium": None,
            "perils": perils, "status": "declined", "incurred": None, "lossRatio": None,
            "summary": summary,
        })
    return docs


def _query_text(case: Case) -> str:
    business_type = (case.business_type.v if isinstance(case.business_type, Known)
                      else case.business_type.point if isinstance(case.business_type, Estimated) else "")
    state = _case_state(case)
    construction = _dominant_construction(case)
    tiv = _case_tiv(case)
    perils = _perils(tuple(t for s in case.sites for t in s.tags))
    line = case.line.v if isinstance(case.line, Known) else "property"
    return (f"{business_type} {line} risk in {state}, {construction} construction, TIV {_money(tiv)}, "
            f"perils {', '.join(perils) or 'none tagged'}")


# ---------- results -----------------------------------------------------------------------------

@dataclass(frozen=True)
class PrecedentHit:
    policy_number: str | None
    case_id: str
    insured: str
    decision: str
    state: str
    line: str
    construction: str
    broker: str
    tiv: float
    premium: float | None
    incurred: float | None
    loss_ratio: float | None
    perils: list[str]
    summary: str
    outcome: str
    similarity: float = 0.0
    basis: list[str] = field(default_factory=list)


def _outcome(doc: dict[str, Any]) -> str:
    if doc["decision"] == "declined":
        return f"declined ({doc['declineReason']})"
    incurred = doc.get("incurred") or 0.0
    if incurred <= 0:
        return f"bound at {_money(doc['premium'])}, no claims on file"
    return f"bound at {_money(doc['premium'])}, {_money(incurred)} incurred (loss ratio {doc['lossRatio']:.2f})"


def _to_hit(doc: dict[str, Any], score: float = 0.0) -> PrecedentHit:
    return PrecedentHit(
        policy_number=doc.get("policyNumber"), case_id=doc["caseId"], insured=doc["insured"],
        decision=doc["decision"], state=doc["state"], line=doc["line"], construction=doc["construction"],
        broker=doc["broker"], tiv=doc["tiv"], premium=doc.get("premium"), incurred=doc.get("incurred"),
        loss_ratio=doc.get("lossRatio"), perils=doc["perils"], summary=doc["summary"],
        outcome=_outcome(doc), similarity=score,
    )


def _basis(case: Case, hit: PrecedentHit) -> list[str]:
    """Why this past risk is comparable: the facts the case and the precedent actually share.
    Read off both records, never generated, so the UI can show the match reason next to the hit."""
    line = case.line.v if isinstance(case.line, Known) else "property"
    perils = set(_perils(tuple(t for s in case.sites for t in s.tags))) & set(hit.perils)
    band = _tiv_band(_case_tiv(case))
    out = []
    if hit.line == line:
        out.append(f"same line ({line})")
    if hit.state == _case_state(case):
        out.append(f"same state ({hit.state})")
    if _tiv_band(hit.tiv) == band:
        out.append(f"same TIV band ({band})")
    if hit.construction == _dominant_construction(case):
        out.append(f"same construction ({hit.construction})")
    if perils:
        out.append("shared perils: " + ", ".join(sorted(perils)))
    return out or ["same book, no shared line, state, size band or peril"]


@dataclass(frozen=True)
class PrecedentResult:
    hits: list[PrecedentHit]
    backend: str
    query: str
    n: int


@dataclass(frozen=True)
class SignificantTerm:
    field: str
    value: str
    doc_count: int
    background_count: int
    score: float


@dataclass(frozen=True)
class DeclinesInsight:
    backend: str
    n_declined: int
    n_loss_making: int
    n_book: int
    declined_terms: list[SignificantTerm]
    loss_making_terms: list[SignificantTerm]


# ---------- the index ---------------------------------------------------------------------------

class PrecedentIndex:
    """Elastic-preferred, in-memory fallback -- same shape as portfolio.ExposureIndex."""

    def __init__(self, client: Any | None, docs: list[dict[str, Any]]) -> None:
        self.client = client
        self.docs = docs

    # ---- 1. search_precedent: hybrid rrf + reranker ---------------------------------------------

    def search(self, case: Case, k: int = 3) -> PrecedentResult:
        query_text = _query_text(case)
        result = None
        if self.client is not None:
            try:
                result = self._search_elastic(query_text, k)
            except Exception:
                result = None
        if result is None:
            result = self._search_memory(case, query_text, k)
        hits = [replace(h, basis=_basis(case, h)) for h in result.hits]
        return replace(result, hits=hits)

    def _search_elastic(self, query_text: str, k: int) -> PrecedentResult:
        retriever = {
            "text_similarity_reranker": {
                "retriever": {"rrf": {"retrievers": [
                    {"standard": {"query": {"match": {"summary": query_text}}}},
                    {"standard": {"query": {"semantic": {"field": "summary", "query": query_text}}}},
                ]}},
                "field": "summary", "inference_id": RERANKER_MODEL, "inference_text": query_text,
            }
        }
        resp = self.client.search(index=PRECEDENT_INDEX, retriever=retriever, size=k)
        hits = [_to_hit(h["_source"], h.get("_score") or 0.0) for h in resp["hits"]["hits"]]
        return PrecedentResult(hits=hits, backend="elastic", query=query_text, n=len(self.docs))

    def _search_memory(self, case: Case, query_text: str, k: int) -> PrecedentResult:
        line = case.line.v if isinstance(case.line, Known) else "property"
        state = _case_state(case)
        construction = _dominant_construction(case)
        tiv_band = _tiv_band(_case_tiv(case))
        perils = set(_perils(tuple(t for s in case.sites for t in s.tags)))
        scored = []
        for doc in self.docs:
            score = 0.0
            if doc["line"] == line:
                score += 3
            if doc["state"] == state:
                score += 3
            if doc["tivBand"] == tiv_band:
                score += 2
            if doc["construction"] == construction:
                score += 2
            score += len(perils & set(doc["perils"]))
            scored.append((score, doc))
        scored.sort(key=lambda sd: (-sd[0], -(sd[1].get("incurred") or 0)))
        hits = [_to_hit(doc, score) for score, doc in scored[:k]]
        return PrecedentResult(hits=hits, backend="memory", query=query_text, n=len(self.docs))

    # ---- 2. significant_terms: what the declined/loss-making book over-indexes on ---------------

    _SIG_FIELDS = ("perils", "state", "construction", "broker")

    def declines_significant_terms(self, size: int = 5) -> DeclinesInsight:
        if self.client is not None:
            try:
                return self._declines_elastic(size)
            except Exception:
                pass
        return self._declines_memory(size)

    def _declines_elastic(self, size: int) -> DeclinesInsight:
        aggs = {f: {"significant_terms": {"field": f, "size": size}} for f in self._SIG_FIELDS}
        declined = self.client.search(index=PRECEDENT_INDEX, size=0,
                                       query={"term": {"decision": "declined"}}, aggs=aggs)
        loss_making = self.client.search(
            index=PRECEDENT_INDEX, size=0,
            query={"bool": {"filter": [{"term": {"decision": "bound"}}, {"range": {"incurred": {"gt": 0}}}]}},
            aggs=aggs)
        n_declined = declined["hits"]["total"]["value"]
        n_loss = loss_making["hits"]["total"]["value"]
        n_book = self.client.count(index=PRECEDENT_INDEX)["count"]

        def terms(resp: dict[str, Any]) -> list[SignificantTerm]:
            out = []
            for field in self._SIG_FIELDS:
                for b in resp["aggregations"][field]["buckets"]:
                    out.append(SignificantTerm(field=field, value=b["key"], doc_count=b["doc_count"],
                                               background_count=b["bg_count"], score=round(b["score"], 3)))
            return sorted(out, key=lambda t: -t.score)

        return DeclinesInsight(backend="elastic", n_declined=n_declined, n_loss_making=n_loss, n_book=n_book,
                               declined_terms=terms(declined), loss_making_terms=terms(loss_making))

    def _declines_memory(self, size: int) -> DeclinesInsight:
        """No significant_terms without a cluster to compute foreground/background rates against, so
        the fallback reports plain over-representation (foreground share / background share) instead
        of the real JLH score -- still real numbers off the same doc set, just a plainer statistic."""
        declined = [d for d in self.docs if d["decision"] == "declined"]
        loss_making = [d for d in self.docs if d["decision"] == "bound" and (d.get("incurred") or 0) > 0]

        def terms(group: list[dict[str, Any]]) -> list[SignificantTerm]:
            out = []
            for field in self._SIG_FIELDS:
                bg_counts: dict[str, int] = {}
                for d in self.docs:
                    vs = d[field] if isinstance(d[field], list) else [d[field]]
                    for v in vs:
                        if v:
                            bg_counts[v] = bg_counts.get(v, 0) + 1
                fg_counts: dict[str, int] = {}
                for d in group:
                    vs = d[field] if isinstance(d[field], list) else [d[field]]
                    for v in vs:
                        if v:
                            fg_counts[v] = fg_counts.get(v, 0) + 1
                for v, n in fg_counts.items():
                    fg_rate = n / len(group) if group else 0.0
                    bg_rate = bg_counts.get(v, 0) / len(self.docs) if self.docs else 1.0
                    out.append(SignificantTerm(field=field, value=v, doc_count=n, background_count=bg_counts.get(v, 0),
                                               score=round(fg_rate / bg_rate, 3) if bg_rate else 0.0))
            return sorted(out, key=lambda t: -t.score)[:size]

        return DeclinesInsight(backend="memory", n_declined=len(declined), n_loss_making=len(loss_making),
                               n_book=len(self.docs), declined_terms=terms(declined),
                               loss_making_terms=terms(loss_making))

    # ---- 3. percentile_ranks: where this TIV/premium falls in the bound book ---------------------

    def percentile_rank(self, tiv: float, premium: float | None) -> dict[str, Any]:
        if self.client is not None:
            try:
                return self._percentile_elastic(tiv, premium)
            except Exception:
                pass
        return self._percentile_memory(tiv, premium)

    def _percentile_elastic(self, tiv: float, premium: float | None) -> dict[str, Any]:
        aggs = {"tiv_rank": {"percentile_ranks": {"field": "tiv", "values": [tiv]}}}
        if premium is not None:
            aggs["premium_rank"] = {"percentile_ranks": {"field": "premium", "values": [premium]}}
        resp = self.client.search(index=PRECEDENT_INDEX, size=0, query={"term": {"decision": "bound"}}, aggs=aggs)
        n = resp["hits"]["total"]["value"]
        out = {"backend": "elastic", "n": n, "tiv": tiv,
               "tivPercentile": round(list(resp["aggregations"]["tiv_rank"]["values"].values())[0], 1)}
        if premium is not None:
            out["premium"] = premium
            out["premiumPercentile"] = round(list(resp["aggregations"]["premium_rank"]["values"].values())[0], 1)
        return out

    def _percentile_memory(self, tiv: float, premium: float | None) -> dict[str, Any]:
        bound = [d for d in self.docs if d["decision"] == "bound"]
        tivs = sorted(d["tiv"] for d in bound)
        out = {"backend": "memory", "n": len(bound), "tiv": tiv,
               "tivPercentile": round(100 * sum(1 for v in tivs if v < tiv) / len(tivs), 1) if tivs else 0.0}
        if premium is not None:
            prems = sorted(d["premium"] for d in bound if d["premium"])
            out["premium"] = premium
            out["premiumPercentile"] = round(100 * sum(1 for v in prems if v < premium) / len(prems), 1) if prems else 0.0
        return out


def open_precedent_index(world: World) -> PrecedentIndex:
    """Prefer the live `pixie-precedent` Elastic index; fall back to the same math run over the same
    doc set in memory if ELASTIC_* isn't set, the project is unreachable, or the index isn't loaded
    yet (run scripts/load_precedent.py)."""
    docs = build_precedent_docs(world)
    client = _elastic_client()
    if client is not None:
        try:
            if not client.indices.exists(index=PRECEDENT_INDEX):
                client = None
        except Exception:
            client = None
    return PrecedentIndex(client, docs)
