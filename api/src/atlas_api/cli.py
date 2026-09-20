"""`atlas` console script. `uv run atlas triage` prints all 158 submissions ranked, with their
interval, decision, and a two-line reason."""

from __future__ import annotations

import sys

from .case import Estimated, Known, World
from .engine import DEFAULT_RULES_DIR, Decided, Open, RulesFile, assess


def _value_at_stake(case) -> float:
    if isinstance(case.tiv, Known):
        return case.tiv.v
    if isinstance(case.tiv, Estimated):
        return case.tiv.hi
    return 0.0


def _reason_lines(a) -> tuple[str, str]:
    d = a.decision
    if isinstance(d, Decided):
        why = ", ".join(d.because) if d.because else "guideline math"
        return f"{d.kind.capitalize()}: {why}.", f"  score {a.score.lo:.0f}-{a.score.hi:.0f}"
    if isinstance(d, Open):
        flips = ", ".join(f"{f.fact} ({f.resolver})" for f in d.flippers) or "no single flipper"
        return (f"Open, straddles {d.straddles:.0f} (score {a.score.lo:.0f}-{a.score.hi:.0f}).",
                f"  flippers: {flips}")
    return f"Routed to {d.to}.", f"  {d.because}"


def triage() -> None:
    from . import guideline
    rules = guideline.active()
    world = World.load()

    rows = []
    for sub in world.submissions.values():
        case = world.case(f"SUB-{sub['id']}")
        a = assess(case, rules)
        insured = world.insureds.get(sub["insured"], {})
        state = case.primary_admin.v if isinstance(case.primary_admin, Known) else "?"
        rows.append({
            "id": sub["id"], "insured": insured.get("name", "?"), "line": sub["line_of_business"],
            "state": state, "case": case, "a": a,
        })

    rows.sort(key=lambda r: (-r["a"].score.mid, -_value_at_stake(r["case"])))

    print(f"{'#':>3}  {'case':<8}{'insured':<30}{'line':<10}{'st':<4}{'interval':<12}decision")
    for rank, r in enumerate(rows, start=1):
        a = r["a"]
        interval = f"[{a.score.lo:>3.0f}-{a.score.hi:>3.0f}]"
        kind = (a.decision.kind if isinstance(a.decision, Decided)
                else "open" if isinstance(a.decision, Open) else "routed")
        line1, line2 = _reason_lines(a)
        insured_name = (r["insured"][:26] + "..") if len(r["insured"]) > 28 else r["insured"]
        print(f"{rank:>3}  SUB-{r['id']:<4}{insured_name:<30}{r['line']:<10}{r['state']:<4}{interval:<12}{kind}")
        print(f"     {line1}")
        print(f"{line2}")

    print(f"\n{len(rows)} submissions triaged.")


def record(case_ids: list[str]) -> None:
    """Run the desk live on `case_ids`, store the events (var/atlas.sqlite) for replay, and write
    eval/desk_run.json with per-case events per actor, calls, cost and wall time."""
    import asyncio
    import json
    from collections import Counter
    from pathlib import Path

    from dotenv import load_dotenv

    from . import app as _app  # noqa: F401  Sentry init (OpenAIAgentsIntegration) when SENTRY_DSN_API is set
    from .case_store import CaseStore
    from .desk import Desk

    load_dotenv()
    store = CaseStore.open()
    desk = Desk(World.load(), store)
    results = asyncio.run(desk.run(case_ids))
    report = {}
    for cid, res in results.items():
        events = store.tail(cid, run_id=store.latest_run(cid))
        by_actor = Counter(e.actor for e in events)
        report[cid] = {
            "runId": events[0].run_id if events else None, "events": len(events), "byActor": dict(by_actor),
            "kinds": dict(Counter(e.kind for e in events)), "verdict": res.decision.verdict,
            "explanation": res.decision.explanation, "fallback": res.decision.fallback,
            "calls": res.calls, "tokensIn": res.tokens_in, "tokensOut": res.tokens_out,
            "costUsd": round(res.cost_usd, 4), "seconds": round(res.seconds, 1),
        }
        print(f"{cid}: {res.decision.verdict} in {res.seconds:.0f} s, {res.calls} calls, ${res.cost_usd:.3f}; "
              f"events {dict(by_actor)}")
    out = Path(__file__).resolve().parents[3] / "eval" / "desk_run.json"
    out.write_text(json.dumps(report, indent=1))
    print(f"wrote {out}")


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["triage"]:
        triage()
    elif args[:1] == ["demo-reset"]:
        import json

        from . import app as app_mod
        from .case_store import CaseStore
        app_mod._store = CaseStore.open()
        app_mod._world = World.load()
        print(json.dumps(app_mod.demo_reset(args[1:] or None), indent=1))
    elif args[:1] == ["ask"]:
        import asyncio
        import json

        from .ask import CANNED, ask
        from .case_store import CaseStore
        async def run_all() -> None:
            for q in (args[1:] or CANNED):
                r = await ask(q, CaseStore.open(), use_cache=False)
                print(json.dumps({"q": q, "attempts": [(a.get("lint"), a.get("error"), a["rows"]) for a in r["attempts"]],
                                  "rows": len(r["rows"]), "answer": r["answer"]}, default=str))
        asyncio.run(run_all())
    elif args[:1] == ["record"] and len(args) == 3 and args[1] == "--cases":
        record([c.strip().removeprefix("SUB-") for c in args[2].split(",") if c.strip()])
    else:
        print("usage: atlas triage | atlas record --cases 138,126,143 | atlas ask [question] | atlas demo-reset [caseId...]", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
