"""Thin Sentry helpers shared by the API and desk runtime.

Every call here is a safe no-op when SENTRY_DSN_API is unset: sentry_sdk with no client queues
into a scope that drops the event. Centralised so call sites read as one line, e.g.
`log("ingest.query", case_id=case_id, resource=payload["resource"])`.

See docs/SENTRY.md for what each stage/event name means and the alert rule built on
`verify_numbers_alert`.
"""

from __future__ import annotations

from typing import Any

import sentry_sdk
import sentry_sdk.logger as _slog

_LEVELS = {"info": _slog.info, "warning": _slog.warning, "error": _slog.error}


def log(event: str, *, level: str = "info", case_id: str | None = None, **attrs: Any) -> None:
    """One structured Sentry log line (Sentry's Logs product). `event` is a dotted stage name
    ("ingest.query", "conflict.detected", "action.send", "webhook.inbound", ...); attrs become
    searchable log attributes. case_id, when given, is always attached."""
    if case_id is not None:
        attrs["case_id"] = case_id
    _LEVELS.get(level, _slog.info)(event, **attrs)


def verify_numbers_alert(case_id: str, agent: str, sentence: str, bad_tokens: list[str], facts: list[str]) -> None:
    """The unconventional guard (AGENTS.md invariant 1, enforced in code by verify_numbers): when an
    agent's sentence states a number none of our computed facts contain, that is not just discarded
    (the caller already falls back to a template) -- it is an error-level Sentry event carrying the
    offending sentence, the case, the agent and the fact list, so an alert rule can fire on it.
    docs/SENTRY.md documents the alert rule this backs."""
    with sentry_sdk.new_scope() as scope:
        scope.set_tag("pixie.alert", "verify_numbers")
        scope.set_context("verify_numbers", {
            "case_id": case_id, "agent": agent, "sentence": sentence,
            "bad_tokens": bad_tokens, "fact_count": len(facts), "facts": facts[-25:],
        })
        sentry_sdk.capture_message(
            f"verify_numbers: {agent} on case {case_id} stated {bad_tokens} -- not in the computed facts",
            level="error")
    log("verify_numbers.rejected", level="error", case_id=case_id, agent=agent,
        bad_tokens=",".join(bad_tokens), sentence=sentence[:200])
