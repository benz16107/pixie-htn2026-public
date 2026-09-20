"""SQLite CaseStore: one file (var/atlas.sqlite), three tables.

One process uses one connection. A reentrant lock serialises every use of it, because
FastAPI runs sync routes on a threadpool and one case page fires eight overlapping reads -- two
threads touching the same sqlite3 connection raise "bad parameter or other API misuse".

Tables: `cases` (pre-rendered QueueRow/CaseView JSON), `desk_events` (the DeskEvent log), and `cache`.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
import threading
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .events import DeskEvent

DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "var" / "atlas.sqlite"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS desk_events (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    run_id TEXT NOT NULL,
    json TEXT NOT NULL,
    UNIQUE(case_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_desk_events_case_seq ON desk_events(case_id, seq);
CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    ts TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


class CaseStore:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn
        self._lock = threading.RLock()

    @classmethod
    def open(cls, path: Path | None = None) -> "CaseStore":
        path = Path(path or os.environ.get("ATLAS_DB") or DEFAULT_DB_PATH)   # ATLAS_DB=var/atlas-demo.sqlite at the demo
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(_SCHEMA)
        conn.commit()
        return cls(conn)

    # ---- cases: pre-rendered {"queue": QueueRow, "case": CaseView} JSON, keyed by case id ------

    def put_case(self, case_id: str, data: dict[str, Any]) -> None:
        with self._lock:
            self.conn.execute(
                "INSERT INTO cases(id, json, updated_at) VALUES (?, ?, datetime('now')) "
                "ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
                (case_id, json.dumps(data)),
            )
            self.conn.commit()

    def get_case(self, case_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.conn.execute("SELECT json FROM cases WHERE id = ?", (case_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def list_cases(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.conn.execute("SELECT json FROM cases ORDER BY id").fetchall()
        return [json.loads(r[0]) for r in rows]

    # ---- disk cache: the Cache interface federato.JsonFileCache also implements ------------------

    def cache_get(self, key: str) -> Any | None:
        with self._lock:
            row = self.conn.execute("SELECT json FROM cache WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def cache_set(self, key: str, value: Any) -> None:
        with self._lock:
            self.conn.execute(
                "INSERT INTO cache(key, json, ts) VALUES (?, ?, datetime('now')) "
                "ON CONFLICT(key) DO UPDATE SET json = excluded.json, ts = excluded.ts",
                (key, json.dumps(value)),
            )
            self.conn.commit()

    # ---- events: the DeskEvent log (events.py). Idempotent by content-hash id; seq is the SSE cursor --

    def append(self, e: "DeskEvent") -> bool:
        """False (and no write) if this event id is already in the log."""
        with self._lock:
            if self.conn.execute("SELECT 1 FROM desk_events WHERE id = ?", (e.id,)).fetchone():
                return False
            seq = self.conn.execute(
                "SELECT COALESCE(MAX(seq), 0) + 1 FROM desk_events WHERE case_id = ?", (e.case_id,)).fetchone()[0]
            e.seq = seq
            self.conn.execute("INSERT INTO desk_events(id, case_id, seq, run_id, json) VALUES (?, ?, ?, ?, ?)",
                              (e.id, e.case_id, seq, e.run_id, e.model_dump_json()))
            self.conn.commit()
            return True

    def tail(self, case_id: str, after_seq: int = 0, run_id: str | None = None) -> list["DeskEvent"]:
        from .events import DeskEvent
        sql, args = "SELECT json FROM desk_events WHERE case_id = ? AND seq > ?", [case_id, after_seq]
        if run_id:
            sql, args = sql + " AND run_id = ?", args + [run_id]
        with self._lock:
            rows = self.conn.execute(sql + " ORDER BY seq", args).fetchall()
        return [DeskEvent.model_validate_json(r[0]) for r in rows]

    def run_events(self, run_id: str) -> list["DeskEvent"]:
        from .events import DeskEvent
        with self._lock:
            rows = self.conn.execute("SELECT json FROM desk_events WHERE run_id = ? ORDER BY case_id, seq",
                                     (run_id,)).fetchall()
        return [DeskEvent.model_validate_json(r[0]) for r in rows]

    def delete_events(self, case_id: str, kinds: set[str]) -> int:
        """Demo reset (T14): drop events of these kinds, keeping the rest of the recorded run."""
        return self._rewrite(case_id, lambda e: e.kind not in kinds)

    def delete_actor(self, case_id: str, actor: str) -> int:
        return self._rewrite(case_id, lambda e: e.actor != actor)

    def _rewrite(self, case_id: str, keep_if) -> int:
        events = self.tail(case_id)
        keep = [e for e in events if keep_if(e)]
        dropped = len(events) - len(keep)
        if dropped:
            with self._lock:
                self.conn.execute("DELETE FROM desk_events WHERE case_id = ?", (case_id,))
                for e in keep:
                    self.conn.execute("INSERT INTO desk_events(id, case_id, seq, run_id, json) VALUES (?, ?, ?, ?, ?)",
                                      (e.id, e.case_id, e.seq, e.run_id, e.model_dump_json()))
                self.conn.commit()
        return dropped

    def latest_run(self, case_id: str) -> str | None:
        with self._lock:
            row = self.conn.execute("SELECT run_id FROM desk_events WHERE case_id = ? ORDER BY seq DESC LIMIT 1",
                                    (case_id,)).fetchone()
        return row[0] if row else None
