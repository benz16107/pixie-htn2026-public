"""Helpers for appending human and rule events after a recorded desk run."""

from __future__ import annotations

import time
from typing import Any

from .case_store import CaseStore
from .events import DeskEvent


def append_after_run(
    store: CaseStore,
    case_id: str,
    run_id: str,
    actor: Any,
    payload: Any,
    refs: list[str] | None = None,
) -> DeskEvent:
    tail = store.tail(case_id)
    t0 = time.time() - ((tail[-1].t_ms if tail else 0) + 2000) / 1000
    event = DeskEvent.make(case_id, run_id, actor, payload, t0=t0, refs=refs)
    store.append(event)
    return event
