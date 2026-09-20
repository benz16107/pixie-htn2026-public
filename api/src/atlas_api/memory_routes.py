"""Read-only API for Pixie's local, number-free cross-case recall."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from . import memory
from .case import World
from .case_store import CaseStore
from .events import DeskEvent, RecallP
from .openai_runtime import recall as session_recall, session

router = APIRouter()

_world: World | None = None
_store: CaseStore | None = None


def init(world: World, store: CaseStore) -> None:
    global _world, _store
    _world, _store = world, store


def _case_or_404(case_id: str):
    assert _world is not None, "memory_routes.init() not called"
    cid = case_id.removeprefix("SUB-")
    try:
        return cid, _world.case(f"SUB-{cid}")
    except (KeyError, ValueError):
        raise HTTPException(status_code=404, detail=f"no case {case_id}")


def _rows(memo: memory.CaseMemo, events: list[DeskEvent], session_lines: list[str]) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    lines = [
        line
        for event in events
        if isinstance((payload := event.payload), RecallP) and payload.source == "session"
        for line in payload.lines
    ]
    lines += session_lines
    for line in lines:
        if line in seen:
            continue
        fields = memory.parse_line(line)
        seen[line] = {
            "caseId": fields.get("case", "?"),
            "insured": fields.get("insured", "?"),
            "broker": fields.get("broker", "?"),
            "state": fields.get("state", ""),
            "dataIssues": [item for item in (fields.get("data_issues") or "").split(", ") if item],
            "why": memory.why_recalled(memo, line),
            "line": line,
        }
    return list(seen.values())


def _summary(cid: str, rows: list[dict[str, Any]]) -> str:
    if not rows:
        return (
            f"The desk has nothing to recall for SUB-{cid}: no earlier case in this session shares "
            "its insured, broker, region, or data issue."
        )
    first = "; ".join(
        f"case {row['caseId']} ({row['insured']}, {row['broker']}): {row['why']}" for row in rows[:2]
    )
    more = f", and {len(rows) - 2} more" if len(rows) > 2 else ""
    return f"On SUB-{cid} the desk recalled {len(rows)} earlier case(s): {first}{more}."


@router.get("/cases/{case_id}/memory")
async def case_memory(case_id: str) -> dict[str, Any]:
    """Return the local session context that the planning turn could read for this case."""

    cid, case = _case_or_404(case_id)
    assert _world is not None and _store is not None
    events: list[DeskEvent] = _store.tail(cid) if _store.latest_run(cid) else []
    ledger = [
        event.payload.model_dump(mode="json", exclude={"kind"})
        for event in events
        if isinstance(event.payload, RecallP) and event.payload.source == "session"
    ]
    session_lines = await session_recall(session(), limit=8, skip_case=cid)
    rows = _rows(memory.memo_for(_world, cid, case), events, session_lines)
    return {
        "caseId": cid,
        "summary": _summary(cid, rows),
        "recalled": rows,
        "boundary": memory.BOUNDARY,
        "source": {
            "name": "Pixie local recall",
            "store": "agents.memory.SQLiteSession",
            "needsNetwork": False,
            "lines": len(rows),
        },
        "fromLedger": ledger,
        "session": session_lines,
    }
