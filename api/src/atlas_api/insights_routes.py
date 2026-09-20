"""Book-insight routes backed by `pixie-precedent` (A3/Elastic lane): precedent search, the
significant_terms "what the book teaches" panel, and TIV/premium percentile rank.

Own `APIRouter`, included once from `app.py` (`app.include_router(insights_routes.router)`) so
other lanes editing app.py don't collide with this file. `init()` is called once from app.py's
lifespan, the same way `get_store()`/`_world` are set up there -- this module holds no state of
its own beyond what `init()` hands it, so tests can call `init()` directly without booting FastAPI.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, HTTPException

from .case import Estimated, Known, World
from .precedent import PrecedentIndex

router = APIRouter()

_world: World | None = None
_precedent: PrecedentIndex | None = None


def init(world: World, precedent: PrecedentIndex) -> None:
    global _world, _precedent
    _world, _precedent = world, precedent


def _case_or_404(case_id: str):
    assert _world is not None, "insights_routes.init() not called"
    cid = case_id.removeprefix("SUB-")
    try:
        return cid, _world.case(f"SUB-{cid}")
    except (KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"no case {case_id}")


_CAMEL = {"policy_number": "policyNumber", "case_id": "caseId", "loss_ratio": "lossRatio"}


def _camel(d: dict[str, Any]) -> dict[str, Any]:
    """Serve both spellings: the web reads camelCase, the loader and tests read snake_case."""
    out = dict(d)
    for snake, camel in _CAMEL.items():
        if snake in d:
            out[camel] = d[snake]
    out.setdefault("basis", d.get("basis") or [])
    return out


@router.get("/cases/{case_id}/precedent")
def case_precedent(case_id: str, k: int = 3, size: int | None = None) -> dict[str, Any]:
    """The `k` nearest past risks (bound or declined) to this case, by hybrid rrf(BM25 + semantic)
    wrapped in a text_similarity_reranker over `pixie-precedent`, and what happened to each. Every
    number in the response is read straight from the index doc, never generated."""
    assert _precedent is not None, "insights_routes.init() not called"
    _cid, case = _case_or_404(case_id)
    k = max(1, min(size if size is not None else k, 10))
    result = _precedent.search(case, k=k)
    n_loss = sum(1 for h in result.hits if (h.incurred or 0) > 0)
    return {
        "caseId": case_id.removeprefix("SUB-"), "backend": result.backend, "index": "pixie-precedent",
        "query": result.query, "n": result.n, "nLossMaking": n_loss,
        "basisExplained": getattr(result, "basis_explained", "nearest by line, state, TIV band, construction and shared perils"),
        "hits": [_camel(asdict(h)) for h in result.hits],
    }


@router.get("/insights/declines")
def insights_declines(size: int = 5) -> dict[str, Any]:
    """significant_terms over declined submissions and loss-making bound policies vs. the whole
    `pixie-precedent` book: which peril tags, states, construction types or brokers are
    over-represented, not just frequent. The "what the book teaches" panel."""
    assert _precedent is not None, "insights_routes.init() not called"
    insight = _precedent.declines_significant_terms(size=size)
    return {
        "backend": insight.backend, "nBook": insight.n_book, "nDeclined": insight.n_declined,
        "nLossMaking": insight.n_loss_making,
        "declined": [asdict(t) for t in insight.declined_terms],
        "lossMaking": [asdict(t) for t in insight.loss_making_terms],
    }


@router.get("/cases/{case_id}/percentile")
def case_percentile(case_id: str) -> dict[str, Any]:
    """This case's TIV (and premium, once bound/estimated) as a percentile rank within the bound
    book -- a `percentile_ranks` aggregation against `pixie-precedent`, computed per request."""
    assert _precedent is not None, "insights_routes.init() not called"
    _cid, case = _case_or_404(case_id)
    tiv = case.tiv.v if isinstance(case.tiv, Known) else case.tiv.point if isinstance(case.tiv, Estimated) else None
    if tiv is None:
        raise HTTPException(status_code=422, detail="no resolvable TIV for this case")
    premium = case.premium.v if isinstance(case.premium, Known) else None
    return {"caseId": case_id.removeprefix("SUB-"), **_precedent.percentile_rank(tiv, premium)}
