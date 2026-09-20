"""The OpenAI Agents SDK layer of the desk: guardrail, per-role model settings, tracing, session.

Four things live here so `desk.py` stays about underwriting:

1. `verify_numbers` and the `numbers_guardrail` that wraps it. The check is the same one that has
   always guarded AGENTS.md invariant 1 ("no number comes from a model"); the difference is that it
   is now an `OutputGuardrail` attached to every `Agent`, so the SDK runs it on the final output of
   every turn and a hallucinated number raises a tripwire the tracing dashboard shows as a guardrail
   span. `desk._turn` catches that tripwire, posts a `guardrail` event, and hands the output back to
   the existing per-sentence fallback, so a tripwire is never a crashed case.
2. `settings_for(role)`: `reasoning.effort` high only where judgment happens (the Lead's final
   decision and the Challenger), low everywhere else; `verbosity` low on structured-output calls and
   high only on the explanation a human reads.
3. `run_config(...)`: `workflow_name="pixie-case-<id>"`, `group_id=<run id>` and trace metadata, so
   one case is one workflow in the OpenAI traces dashboard and every agent turn in a run groups.
4. `session(...)`: a per-underwriter `SQLiteSession` holding one line per closed case. Strictly
   advisory: the desk writes number-free lines, reads them into the Lead's planning prompt only, and
   never adds them to the run's fact list -- so a number that exists only in memory cannot survive
   verify_numbers.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Callable

from agents import GuardrailFunctionOutput, ModelSettings, OutputGuardrail, RunConfig, output_guardrail
from agents.memory import SQLiteSession
from openai.types.shared import Reasoning
from pydantic import BaseModel

API_DIR = Path(__file__).resolve().parents[2]
SESSION_DB = API_DIR / "cache" / "desk-sessions.sqlite"


# ---------- verify_numbers: the check (invariant 1) ------------------------------------------------

_NUM = re.compile(r"(?<![\w.])\$?(\d[\d,]*(?:\.\d+)?)\s?([kKmMbB](?![a-zA-Z]))?")


def _numbers(text: str) -> list[tuple[str, float, float]]:
    """(token, value, rounding tolerance) for every number in text; $2.1M -> 2,100,000 +/- 50,000."""
    out = []
    for m in _NUM.finditer(text):
        digits, suffix = m.group(1).rstrip(",").replace(",", ""), (m.group(2) or "").lower()
        if not digits or digits.endswith("."):
            digits = digits.rstrip(".")
        scale = {"k": 1e3, "m": 1e6, "b": 1e9}.get(suffix, 1.0)
        decimals = len(digits.split(".")[1]) if "." in digits else 0
        out.append((m.group(0).strip(), float(digits) * scale, 0.5 * 10 ** -decimals * scale if suffix else 1e-9))
    return out


def verify_numbers(text: str, facts: list[str] | dict[str, str]) -> list[str]:
    """Numbers in `text` that no computed fact string contains (after $/K/M normalisation). [] = pass."""
    corpus = facts.values() if isinstance(facts, dict) else facts
    allowed = [v for s in corpus for _t, v, _tol in _numbers(s)]
    return [tok for tok, v, tol in _numbers(text) if not any(abs(a - v) <= tol for a in allowed)]


# ---------- the guardrail -------------------------------------------------------------------------

# The free-text fields of the structured outputs. Only these are checked, because only these reach
# the ledger as prose; `case_id`, `verdict`, `option`, `depth` and `to` are enums or ids code chose.
PROSE_FIELDS = frozenset({"answer", "argument", "change_my_mind", "explanation", "question", "reason",
                          "remedy", "response", "risk", "size", "summary", "text"})


def prose(output: Any) -> str:
    """Every free-text field of a structured agent output, joined. Nested models are walked."""
    if isinstance(output, str):
        return output
    if isinstance(output, BaseModel):
        output = output.model_dump()
    if isinstance(output, list):
        return "\n".join(p for p in (prose(v) for v in output) if p)
    if isinstance(output, dict):
        parts = []
        for k, v in output.items():
            if isinstance(v, (dict, list)) or isinstance(v, BaseModel):
                parts.append(prose(v))            # nested model or list: same field filter applies inside
            elif k in PROSE_FIELDS and isinstance(v, str):
                parts.append(v)
        return "\n".join(p for p in parts if p)
    return ""


def numbers_guardrail(facts: Callable[[], list[str]]) -> OutputGuardrail:
    """An SDK output guardrail over `verify_numbers`, reading the run's fact list at check time.

    `facts` is a callable, not a list, because the whitelist grows as tools compute during the turn.
    """

    @output_guardrail(name="verify_numbers")
    def verify_numbers_guardrail(ctx: Any, agent: Any, output: Any) -> GuardrailFunctionOutput:
        text = prose(output)
        known = facts()
        bad = verify_numbers(text, known)
        return GuardrailFunctionOutput(
            output_info={"agent": getattr(agent, "name", "?"), "bad_tokens": bad,
                         "prose": text[:400], "fact_count": len(known)},
            tripwire_triggered=bool(bad))

    return verify_numbers_guardrail


# ---------- per-role model settings ---------------------------------------------------------------

# role -> (reasoning effort, verbosity, why). Roles starting with "lead" run on the flagship model.
ROLE_SETTINGS: dict[str, tuple[str, str, str]] = {
    "lead_plan": ("low", "low", "routing from a code triage into a depth and 1-3 briefs; the floor is code's"),
    "intake": ("low", "low", "a lookup with a typed answer; the hydration path and the estimate are tools"),
    "hazard": ("low", "low", "picks which cached layers to read; every number is the engine's delta"),
    "portfolio": ("low", "low", "one concentration tool call, narrated in two sentences"),
    "appetite": ("low", "low", "narrates the deterministic engine's own output; cannot move a score"),
    "answer": ("low", "low", "a one-to-two sentence reply to another agent, from the lane so far"),
    "challenger": ("high", "low", "argues against the draft decision: the one adversarial turn on the desk"),
    "lead_decide": ("high", "high", "the final verdict and the explanation an underwriter reads"),
    "lead_respond": ("high", "high", "answers every challenged risk and may change the verdict"),
}


def settings_for(role: str) -> ModelSettings:
    effort, verbosity, _why = ROLE_SETTINGS.get(role, ("low", "low", ""))
    return ModelSettings(reasoning=Reasoning(effort=effort), verbosity=verbosity)  # type: ignore[arg-type]


def model_for(role: str, lead: str, specialist: str) -> str:
    return lead if role.startswith("lead") else specialist


def settings_table(lead: str, specialist: str) -> list[dict[str, str]]:
    """The per-role settings as rows the UI and the trace metadata can both show."""
    return [{"role": role, "model": model_for(role, lead, specialist), "reasoningEffort": effort,
             "verbosity": verbosity, "why": why}
            for role, (effort, verbosity, why) in ROLE_SETTINGS.items()]


# ---------- tracing -------------------------------------------------------------------------------

def tracing_off() -> bool:
    return os.environ.get("ATLAS_TRACING", "").lower() in ("0", "off", "false")


def run_config(case_id: str, run_id: str, role: str, model: str, depth: str = "") -> RunConfig:
    """One workflow per case, one group per run, so a judge can open the traces dashboard and watch."""
    effort, verbosity, _why = ROLE_SETTINGS.get(role, ("low", "low", ""))
    return RunConfig(
        workflow_name=f"pixie-case-{case_id}",
        group_id=run_id,
        trace_metadata={"product": "pixie", "case_id": case_id, "run_id": run_id, "role": role,
                        "model": model, "reasoning_effort": effort, "verbosity": verbosity,
                        "depth": depth, "output_guardrail": "verify_numbers"},
        tracing_disabled=tracing_off(),
    )


# ---------- the per-underwriter session -----------------------------------------------------------

def underwriter() -> str:
    return os.environ.get("ATLAS_UNDERWRITER", "desk")


def session(name: str | None = None, db_path: Path | str | None = None) -> SQLiteSession:
    """Durable cross-case recall for one underwriter. One row per closed case, written by the desk."""
    path = Path(db_path) if db_path else SESSION_DB
    path.parent.mkdir(parents=True, exist_ok=True)
    return SQLiteSession(f"underwriter:{name or underwriter()}", path)


async def remember(sess: SQLiteSession, line: str) -> None:
    """Append one line. The desk builds these from identity and issue kinds only: no number, no tier."""
    await sess.add_items([{"role": "assistant", "content": line}])


async def recall(sess: SQLiteSession, limit: int = 8, skip_case: str = "") -> list[str]:
    """The last `limit` lines, newest last, minus this case's own. Advisory only: the caller must not
    add these to the run's fact list, so any number in them still fails verify_numbers."""
    items = await sess.get_items(limit)
    out = []
    for item in items:
        content = item.get("content") if isinstance(item, dict) else None
        if isinstance(content, str) and content and content.split(";")[0].strip() != f"case {skip_case}":
            out.append(content)
    return out
