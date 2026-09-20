"""T9: plain English -> Federato query, by the Intake agent, with the attempts shown.

    await ask("Open property submissions with no premium", store)   # AskResult dict (contract.ts AskResult)

Each attempt: the model drafts a payload from the schema summary and the query grammar; code lints it
(QueryBuilder.lint) and only runs a lint-clean payload; a lint issue or a parsed FederatoError goes back
to the model as the fix to make. Up to 3 attempts. The answer sentence is checked by verify_numbers
against the returned rows; a failure falls back to a row-count template. Results are cached in the
store by question, so the canned chips answer offline.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from agents import Agent, Runner
from pydantic import BaseModel

from .case_store import CaseStore
from .desk import ModelConfig, federato_tools, verify_numbers

CANNED = [
    "Florida property locations with unsprinklered buildings over $5M TIV",
    "Open property submissions with no premium",
    "Property policies over the $175K premium ceiling",
]
_GRAMMAR = Path(__file__).resolve().parents[3] / "docs" / "federato" / "QUERY_REQUEST_BODY.txt"
MAX_ATTEMPTS = 3
MAX_ROWS = 50


class QueryDraft(BaseModel):
    rationale: str       # one sentence: which resource and path, and why
    payload_json: str    # the Federato query body as JSON


class AnswerDraft(BaseModel):
    answer: str


def _grammar() -> str:
    return _GRAMMAR.read_text() if _GRAMMAR.exists() else (
        "Body keys: resource, where (before expand), expand (hydrate references: {ref: true} or nested), unwind "
        "(fan an array into rows), filter (after expand/unwind), select (list of paths), sort, pagination {limit}. "
        "Mongo-style operators: $eq $ne $gt $gte $lt $lte $in $nin $exists $elemMatch $and $or $not.")


@lru_cache(maxsize=1)
def _vocab() -> str:
    """Enum-like string values per resource (<= 12 distinct), so drafts filter on real values ("cleared", not "open")."""
    from .case import DEFAULT_SNAPSHOT_DIR
    from .federato import Snapshot
    snap = Snapshot.load(DEFAULT_SNAPSHOT_DIR)
    lines = []
    for res, recs in snap.records.items():
        fields: dict[str, set] = {}
        for r in recs.values():
            for k, v in r.items():
                if isinstance(v, str) and not k.endswith(("date", "name", "number", "email", "phone", "id")):
                    fields.setdefault(k, set()).add(v)
        enums = [f"{k}={sorted(v)}" for k, v in fields.items() if 1 < len(v) <= 12]
        if enums:
            lines.append(f"{res}: {'; '.join(enums)}")
    return "\n".join(lines)


def _flatten(row: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in row.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(_flatten(v, key + "."))
        elif isinstance(v, list):
            out[key] = ", ".join(str(x.get("id", x) if isinstance(x, dict) else x) for x in v[:6])
        else:
            out[key] = v
    return out


def _key(question: str) -> str:
    return "ask:" + hashlib.sha256(" ".join(question.lower().split()).encode()).hexdigest()[:16]


async def ask(question: str, store: CaseStore, *, use_cache: bool = True) -> dict[str, Any]:
    key = _key(question)
    if use_cache and (hit := store.cache_get(key)) is not None:
        return {**hit, "path": "cache"}
    if os.environ.get("ATLAS_OFFLINE") == "1":
        return {"question": question, "rationale": "offline: this question is not cached", "attempts": [],
                "finalPayload": None, "columns": [], "rows": [], "answer": "Offline, and this question has no cached answer.",
                "runId": key, "path": "offline"}

    from .federato import FederatoError
    client, graph, qb = federato_tools()
    models = ModelConfig.from_env()
    intake = Agent(name="intake", model=models.specialist, output_type=QueryDraft, instructions=(
        "You are Intake. Turn the underwriter's question into one Federato query body. Use only resources and "
        "fields from the schema summary. A dot-path through an array or reference field needs expand plus unwind "
        "(then filter), or $elemMatch. Select only the columns that answer the question, and cap pagination at "
        f"limit {MAX_ROWS}. Open submissions are the ones with status received, cleared or quoted; premium exists "
        "only on Policy, so an open submission has no premium by construction.\n\nString values in the data:\n"
        f"{_vocab()}\n\nSchema summary:\n{graph.summary()}\n\nQuery grammar:\n{_grammar()}"))

    attempts: list[dict[str, Any]] = []
    feedback, rationale, final, rows, total = "", "", None, [], 0
    for _ in range(MAX_ATTEMPTS):
        prompt = question if not feedback else (
            f"{question}\n\nYour previous payload:\n{attempts[-1]['payload']}\n\nFix this and return a corrected payload: {feedback}")
        draft: QueryDraft = (await Runner.run(intake, prompt, max_turns=2)).final_output
        rationale = draft.rationale
        try:
            payload = json.loads(draft.payload_json)
        except json.JSONDecodeError as exc:
            attempts.append({"payload": draft.payload_json, "lint": [], "error": f"not JSON: {exc}", "rows": 0})
            feedback = attempts[-1]["error"]
            continue
        lint = [f"{i.kind} at {i.at}: {i.fix}" for i in qb.lint(payload)]
        attempt: dict[str, Any] = {"payload": payload, "lint": lint, "rows": 0}
        attempts.append(attempt)
        if lint:
            feedback = "lint: " + "; ".join(lint)
            attempt["fix"] = feedback
            continue
        try:
            res = await asyncio.to_thread(client.query, payload)
        except FederatoError as err:
            attempt["error"] = str(err)
            feedback = f"the API rejected it: {err} {json.dumps(err.details)[:300]}"
            attempt["fix"] = feedback
            continue
        attempt["rows"] = res.total
        if res.total == 0 and len(attempts) < MAX_ATTEMPTS:
            feedback = "it returned 0 rows; check the filter values against the string values listed, and the path"
            attempt["fix"] = feedback
            continue
        final, rows, total = payload, [_flatten(r) for r in res.rows[:MAX_ROWS]], res.total
        break

    columns = list(rows[0].keys()) if rows else []
    template = (f"{total} rows matched." if final is not None else
                f"No query ran cleanly after {len(attempts)} attempts; see the attempts for the errors.")
    answer = template
    if final is not None:
        facts = [json.dumps(rows, default=str), f"{total} rows", f"{len(rows)} shown", question]
        out: AnswerDraft = (await Runner.run(Agent(
            name="intake", model=models.specialist, output_type=AnswerDraft,
            instructions="Answer the underwriter's question in one sentence from these rows only. Repeat numbers "
                         "exactly as they appear in the rows or the row count; never compute a new number."),
            json.dumps({"question": question, "total_rows": total, "rows": rows[:20]}, default=str),
            max_turns=1)).final_output
        answer = out.answer if not verify_numbers(out.answer, facts) else template

    result = {"question": question, "rationale": rationale, "attempts": attempts, "finalPayload": final,
              "columns": columns, "rows": rows, "answer": answer, "answerFallback": answer == template,
              "runId": key, "path": "live", "total": total}
    store.cache_set(key, result)
    return result
