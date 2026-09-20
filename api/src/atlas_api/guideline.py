"""The live guideline: read it, edit it, apply it, undo it.

`rules/property_2025.yaml` is the carrier's appetite. Until now it was read once at startup and
never changed. This module holds the *active* guideline in memory, so an underwriting leader can
move a threshold or a band and the desk re-scores every case against it (Federato calls this
surface Control Tower; docs/GUIDELINE.md maps ours onto theirs).

Three rules the rest of the code depends on:

1. **One source.** Every place that used to call `RulesFile.load(DEFAULT_RULES_DIR / ...)` now calls
   `active()`. If a caller reads the file directly, the case page and the queue will disagree.
2. **Atomic.** `apply_doc` validates the whole document, builds the new `RulesFile`, and only then
   swaps it in. A rejected edit leaves the previous guideline exactly as it was.
3. **Reversible.** `reset()` restores the file as it is on disk. `/demo/reset` calls it, so one
   button puts the standard demo back.

Nothing here writes to disk: an edit lives for the life of the process (docs/GUIDELINE.md,
"Honest limitations").
"""

from __future__ import annotations

import copy
import hashlib
import json
from typing import Any

import yaml

from .engine import DEFAULT_RULES_DIR, Band, RulesFile
from .explain import FACT_LABELS, band_text

ACTIVE_PATH = DEFAULT_RULES_DIR / "property_2025.yaml"
BAND_ORDER: tuple[Band, ...] = ("target", "acceptable", "not_acceptable")

_original: dict[str, Any] | None = None       # the file as it is on disk, never mutated
_raw: dict[str, Any] | None = None            # the active document, as a plain mapping
_rules: RulesFile | None = None               # the parsed active guideline


class GuidelineError(ValueError):
    """A rejected edit. The message names the problem; the API returns it as a 422 detail."""


# ---------- state ----------------------------------------------------------------------------

def _ensure() -> None:
    global _original, _raw, _rules
    if _rules is None:
        _original = yaml.safe_load(ACTIVE_PATH.read_text())
        _raw = copy.deepcopy(_original)
        _rules = RulesFile.from_raw(_raw, str(ACTIVE_PATH))


def active() -> RulesFile:
    """The guideline every scorer must use. Cheap: the parse is cached until an edit swaps it."""
    _ensure()
    assert _rules is not None
    return _rules


def active_raw() -> dict[str, Any]:
    _ensure()
    assert _raw is not None
    return copy.deepcopy(_raw)


def edited() -> bool:
    _ensure()
    return _raw != _original


def digest(raw: dict[str, Any] | None = None) -> str:
    """Content hash of the active document, so the UI can tell it changed under it."""
    _ensure()
    body = json.dumps(raw if raw is not None else _raw, sort_keys=True, default=str)
    return hashlib.sha256(body.encode()).hexdigest()[:12]


def reset() -> RulesFile:
    """Back to the file on disk. Idempotent."""
    global _raw, _rules
    _ensure()
    _raw = copy.deepcopy(_original)
    _rules = RulesFile.from_raw(_raw, str(ACTIVE_PATH))
    return _rules


def apply_doc(doc: dict[str, Any]) -> RulesFile:
    """Validate a whole edited document, then swap it in. Raises GuidelineError, changing nothing."""
    global _raw, _rules
    _ensure()
    raw = _raw_from_doc(doc)
    validate(raw)
    try:
        rules = RulesFile.from_raw(raw, "<edited guideline>")          # the file's own checks, again
    except ValueError as e:
        raise GuidelineError(str(e).replace("<edited guideline>: ", "")) from e
    _raw, _rules = raw, rules                                          # the swap, after every check
    return rules


# ---------- document <-> raw yaml mapping ------------------------------------------------------

def doc() -> dict[str, Any]:
    """The active guideline as the screen reads it, and as `PUT /guideline` accepts it back."""
    _ensure()
    assert _raw is not None
    return {
        "id": _raw["id"],
        "kind": _raw.get("kind", "commercial"),
        "hash": digest(),
        "edited": edited(),
        "thresholds": dict(_raw["thresholds"]),
        "hardFailCap": _raw.get("hard_fail_cap"),
        "points": dict(_raw["points"]),
        "factors": [
            {
                "fact": f["fact"],
                "label": FACT_LABELS.get(f["fact"], f["fact"].replace("_", " ")),
                "hardFail": bool(f.get("hard_fail", False)),
                "routes": bool(f.get("route_if_not_acceptable", False)),
                "source": _raw.get("required", {}).get(f["fact"], ""),
                "bands": [
                    {"band": b, "pred": pred, "text": band_text(f["fact"], b, pred)}
                    for b, pred in f["bands"].items()
                ],
            }
            for f in _raw["factors"]
        ],
        "scenarios": SCENARIOS,
    }


def _raw_from_doc(doc_in: dict[str, Any]) -> dict[str, Any]:
    """Document -> the yaml mapping RulesFile parses. Keys the screen never edits (required,
    risk_points, portfolio_points, pricing) are carried over from the active guideline."""
    _ensure()
    assert _raw is not None
    raw = copy.deepcopy(_raw)
    if not isinstance(doc_in, dict):
        raise GuidelineError("a guideline document is an object")
    if "thresholds" in doc_in:
        raw["thresholds"] = dict(doc_in["thresholds"])
    if "points" in doc_in:
        raw["points"] = dict(doc_in["points"])
    if "hardFailCap" in doc_in:
        raw["hard_fail_cap"] = doc_in["hardFailCap"]
    if "factors" in doc_in:
        factors = []
        for f in doc_in["factors"]:
            if not isinstance(f, dict) or "fact" not in f:
                raise GuidelineError("every factor needs a `fact` name")
            bands: dict[str, Any] = {}
            for b in f.get("bands", []):
                if not isinstance(b, dict) or "band" not in b or "pred" not in b:
                    raise GuidelineError(f"{f['fact']}: every band needs a `band` name and a `pred`")
                bands[b["band"]] = b["pred"]
            out = {"fact": f["fact"], "hard_fail": bool(f.get("hardFail", False)), "bands": bands}
            if f.get("routes"):
                out["route_if_not_acceptable"] = True
            factors.append(out)
        raw["factors"] = factors
    return raw


# ---------- validation: everything, before anything is applied ----------------------------------

def _number(x: Any, what: str) -> float:
    if isinstance(x, bool) or not isinstance(x, (int, float)):
        raise GuidelineError(f"{what} must be a number, not {x!r}")
    return float(x)


def validate(raw: dict[str, Any]) -> None:
    """Every check, run before the swap. Each failure names the thing that is wrong."""
    thresholds = raw.get("thresholds") or {}
    for key in ("decline", "accept"):
        if key not in thresholds:
            raise GuidelineError(f"the guideline needs a {key} threshold")
    decline = _number(thresholds["decline"], "the decline threshold")
    accept = _number(thresholds["accept"], "the accept threshold")
    for name, v in (("decline", decline), ("accept", accept)):
        if not 0 <= v <= 100:
            raise GuidelineError(f"the {name} threshold is a score out of 100, so {v:g} is out of range")
    if decline >= accept:
        raise GuidelineError(
            f"the decline threshold ({decline:g}) must sit below the accept threshold ({accept:g}); "
            f"otherwise no case can be open")

    cap = raw.get("hard_fail_cap")
    if cap is not None:
        cap = _number(cap, "the hard-fail cap")
        if cap > accept:
            raise GuidelineError(
                f"the hard-fail cap ({cap:g}) is above the accept threshold ({accept:g}), so a case "
                f"that breaks a hard rule could still be accepted")
        if cap < 0:
            raise GuidelineError(f"the hard-fail cap cannot be negative ({cap:g})")

    points = raw.get("points") or {}
    for band in BAND_ORDER:
        if band not in points:
            raise GuidelineError(f"the points table needs a value for {band}")
    t, a, n = (_number(points[b], f"{b} points") for b in BAND_ORDER)
    if not (t > a > n):
        raise GuidelineError(
            f"the points table must reward better bands more: target ({t:g}) > acceptable ({a:g}) > "
            f"not_acceptable ({n:g})")

    factors = raw.get("factors") or []
    if not factors:
        raise GuidelineError("a guideline with no factors would score every case the same")
    seen = set()
    for f in factors:
        fact = f.get("fact")
        if fact in seen:
            raise GuidelineError(f"{fact} is listed twice; a factor is scored once")
        seen.add(fact)
        bands = f.get("bands") or {}
        if not bands:
            raise GuidelineError(f"{fact}: a factor needs at least one band")
        for band, pred in bands.items():
            if band not in BAND_ORDER:
                raise GuidelineError(f"{fact}: unknown band {band!r}")
            _validate_pred(fact, band, pred)
        # The catch-all is what a value outside every range falls into. `not_acceptable` is it,
        # whether it is spelled `{else: true}` or given its own test (the engine's own fallback
        # band). A factor that only lists target and acceptable would score an out-of-range value
        # as not_acceptable with no written rule behind it.
        if "not_acceptable" not in bands:
            raise GuidelineError(
                f"{fact}: no catch-all band. Add a not_acceptable band (`else: true`), or a value "
                f"outside every range would fall through unscored")


def _validate_pred(fact: str, band: str, pred: Any) -> None:
    if not isinstance(pred, dict) or not pred:
        raise GuidelineError(f"{fact}.{band}: a band needs a test, e.g. {{between: [lo, hi]}}")
    if "between" in pred:
        rng = pred["between"]
        if not isinstance(rng, (list, tuple)) or len(rng) != 2:
            raise GuidelineError(f"{fact}.{band}: `between` takes exactly two numbers")
        lo = _number(rng[0], f"{fact}.{band} lower edge")
        hi = _number(rng[1], f"{fact}.{band} upper edge")
        if lo > hi:
            raise GuidelineError(
                f"{fact}.{band}: the range {lo:g} to {hi:g} is inverted; the lower edge must come first")
        if lo == hi:
            raise GuidelineError(
                f"{fact}.{band}: the range {lo:g} to {hi:g} is empty; it matches a single value only")
    for op in ("lt", "lte", "gt", "gte"):
        if op in pred:
            _number(pred[op], f"{fact}.{band} {op}")
    if "in" in pred:
        values = pred["in"]
        if not isinstance(values, (list, tuple)) or not values:
            raise GuidelineError(f"{fact}.{band}: the list is empty, so this band can never match")
        if len(set(map(str, values))) != len(values):
            raise GuidelineError(f"{fact}.{band}: the list repeats a value")
    if "share_gt" in pred:
        share = pred["share_gt"]
        if not isinstance(share, (list, tuple)) or len(share) != 2 or not share[1]:
            raise GuidelineError(f"{fact}.{band}: `share_gt` takes a fraction and a non-empty list of types")
        frac = _number(share[0], f"{fact}.{band} share")
        if not 0 <= frac < 1:
            raise GuidelineError(f"{fact}.{band}: a share is a fraction between 0 and 1, not {frac:g}")


# ---------- what the human changed, in words ----------------------------------------------------

def describe(old: dict[str, Any], new: dict[str, Any]) -> list[str]:
    """The edits between two guideline mappings, one plain sentence each. Rendered from the two
    documents, so the audit line cannot claim an edit that did not happen."""
    out: list[str] = []
    for key in ("decline", "accept"):
        a, b = (old.get("thresholds") or {}).get(key), (new.get("thresholds") or {}).get(key)
        if a != b:
            out.append(f"{key} threshold {a:g} becomes {b:g}")
    if old.get("hard_fail_cap") != new.get("hard_fail_cap"):
        out.append(f"hard-fail cap {old.get('hard_fail_cap')} becomes {new.get('hard_fail_cap')}")
    for band in BAND_ORDER:
        a, b = (old.get("points") or {}).get(band), (new.get("points") or {}).get(band)
        if a != b:
            out.append(f"{band} is worth {b} points, was {a}")

    old_f = {f["fact"]: f for f in old.get("factors", [])}
    new_f = {f["fact"]: f for f in new.get("factors", [])}
    for fact in old_f.keys() - new_f.keys():
        out.append(f"{fact} is no longer scored")
    for fact in new_f.keys() - old_f.keys():
        out.append(f"{fact} is now scored")
    for fact, nf in new_f.items():
        of = old_f.get(fact)
        if of is None:
            continue
        if bool(of.get("hard_fail")) != bool(nf.get("hard_fail")):
            out.append(f"{fact} is {'now' if nf.get('hard_fail') else 'no longer'} a hard fail")
        for band, pred in nf["bands"].items():
            was = of["bands"].get(band)
            if was == pred:
                continue
            if was is None:
                out.append(f"{fact} gains a {band} band: {band_text(fact, band, pred)}")
            elif "in" in pred and "in" in was:
                added = [v for v in pred["in"] if v not in was["in"]]
                dropped = [v for v in was["in"] if v not in pred["in"]]
                bits = ([f"{', '.join(map(str, added))} added"] if added else []) + \
                       ([f"{', '.join(map(str, dropped))} dropped"] if dropped else [])
                out.append(f"{fact} {band}: {'; '.join(bits)}")
            else:
                out.append(f"{fact} {band_text(fact, band, was)} becomes {band_text(fact, band, pred)}")
        for band in of["bands"].keys() - nf["bands"].keys():
            out.append(f"{fact} loses its {band} band")
    return out


# ---------- the diff: what the edit did to the book ---------------------------------------------

def _tier(view: dict[str, Any]) -> str:
    return (view.get("decision") or {}).get("kind", "?")


def _bands(view: dict[str, Any]) -> dict[str, list[str]]:
    return {f["fact"]: f.get("possible", []) for f in view.get("factors", [])}


IN_QUEUE = {"open", "accept", "refer", "approve"}


def diff(before: dict[str, dict[str, Any]], after: dict[str, dict[str, Any]],
         rank_before: list[str], rank_after: list[str]) -> dict[str, Any]:
    """What changed, case by case, between two full re-scores of the book.

    `before`/`after` are {case_id: stored {"queue", "case"} view}; the rank lists are the open
    queue's order. Pure: it reads two sets of already-computed views and compares them.
    """
    changed: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    value_in = value_out = 0.0
    for cid, was in before.items():
        now = after.get(cid)
        if now is None:
            continue
        t0, t1 = _tier(was["case"]), _tier(now["case"])
        b0, b1 = _bands(was["case"]), _bands(now["case"])
        moved = [{"fact": fact, "from": b0[fact], "to": bands,
                  "value": next((f["valueText"] for f in now["case"].get("factors", [])
                                 if f["fact"] == fact), "")}
                 for fact, bands in b1.items() if b0.get(fact) != bands]
        if t0 == t1 and not moved and was["case"].get("score") == now["case"].get("score"):
            continue
        row = was["queue"]
        stake = float(row.get("valueAtStake") or 0.0)
        if t0 != t1:
            counts[f"{t0}->{t1}"] = counts.get(f"{t0}->{t1}", 0) + 1
            if t0 not in IN_QUEUE and t1 in IN_QUEUE:
                value_in += stake
            elif t0 in IN_QUEUE and t1 not in IN_QUEUE:
                value_out += stake
        changed.append({
            "caseId": cid,
            "insured": row.get("insured", "?"),
            "tierBefore": t0, "tierAfter": t1, "tierChanged": t0 != t1,
            "scoreBefore": was["case"].get("score"), "scoreAfter": now["case"].get("score"),
            "valueAtStake": stake,
            "factors": moved,
        })
    changed.sort(key=lambda c: (not c["tierChanged"], -c["valueAtStake"]))

    i0 = {cid: i for i, cid in enumerate(rank_before)}
    moves = [{"caseId": cid, "from": i0[cid] + 1, "to": i + 1, "delta": i0[cid] - i,
              "insured": (after.get(cid) or {}).get("queue", {}).get("insured", "?")}
             for i, cid in enumerate(rank_after) if cid in i0 and i0[cid] != i]
    moves.sort(key=lambda m: -abs(m["delta"]))
    entered = [cid for cid in rank_after if cid not in i0]
    left = [cid for cid in rank_before if cid not in set(rank_after)]
    return {
        "casesScored": len(before),
        "changed": len(changed),
        "tierChanges": sum(1 for c in changed if c["tierChanged"]),
        "counts": counts,
        "valueIntoQueue": value_in,
        "valueOutOfQueue": value_out,
        "cases": changed,
        "rankMoves": moves[:8],
        "enteredQueue": entered,
        "leftQueue": left,
    }


# ---------- one-click scenarios -----------------------------------------------------------------
# Each edit is the same shape the screen's own inline controls produce, so a scenario button and a
# hand edit go through one code path. `effect` is measured against the demo book (docs/GUIDELINE.md),
# not guessed: api/tests/test_guideline.py asserts each one still does what it says.

_ACCEPTABLE_STATES = ["OH", "PA", "MD", "CO", "CA", "FL", "NC", "SC", "GA", "VA", "UT"]

SCENARIOS: list[dict[str, Any]] = [
    {
        "id": "open-washington",
        "label": "Open Washington",
        "note": "Add WA to the acceptable states.",
        "effect": "1 decline becomes open: #143 Aperture Cloud Corp, $26.3M, which moves from 4th "
                  "to 2nd in the open queue.",
        "edits": [{"kind": "band", "fact": "primary_admin", "band": "acceptable", "op": "in",
                   "value": _ACCEPTABLE_STATES + ["WA"]}],
    },
    {
        "id": "open-texas",
        "label": "Open Texas",
        "note": "Add TX to the acceptable states.",
        "effect": "No decision changes. 7 cases re-band on state, but every Texas case in the queue "
                  "also breaks the loss-history rule, so the state was not what was holding them.",
        "edits": [{"kind": "band", "fact": "primary_admin", "band": "acceptable", "op": "in",
                   "value": _ACCEPTABLE_STATES + ["TX"]}],
    },
    {
        "id": "loss-tolerance",
        "label": "Tolerate losses to $1.5M",
        "note": "Raise the 5-year loss ceiling from $100,000 to $1,500,000.",
        "effect": "20 cases re-band on loss history and 1 decline becomes open ($13.4M). Click it "
                  "after Open Texas and #134 Willowbrook Stores, $24.3M, becomes open too.",
        "edits": [{"kind": "band", "fact": "loss_5yr", "band": "acceptable", "op": "lt",
                   "value": 1500000}],
    },
    {
        "id": "premium-floor-75k",
        "label": "Premium floor to $75K",
        "note": "Raise the acceptable premium floor from $50,000 to $75,000.",
        "effect": "The book's one accept becomes a decline: #81 Coastal Freight Systems, $18.5M, "
                  "on a premium of $58,800.",
        "edits": [{"kind": "band", "fact": "premium", "band": "acceptable", "op": "between",
                   "value": [75000, 175000]}],
    },
    {
        "id": "soften-hard-fail",
        "label": "Soften the hard-fail cap to 50",
        "note": "A case that breaks one hard rule is capped at 50 instead of 30, which is above the "
                "decline line.",
        "effect": "27 declines become open and $1.34B of TIV lands back in the queue. The blunt "
                  "lever, and the reason a cap above the accept threshold is refused.",
        "edits": [{"kind": "cap", "value": 50}],
    },
]


def apply_edits(doc_in: dict[str, Any], edits: list[dict[str, Any]]) -> dict[str, Any]:
    """Apply scenario edits to a document. The screen does this in TypeScript; the API keeps its own
    copy so tests (and `python -m atlas_api.guideline`) can measure what a scenario really does."""
    out = copy.deepcopy(doc_in)
    for edit in edits:
        if edit["kind"] == "threshold":
            out["thresholds"][edit["key"]] = edit["value"]
        elif edit["kind"] == "cap":
            out["hardFailCap"] = edit["value"]
        elif edit["kind"] == "points":
            out["points"][edit["key"]] = edit["value"]
        elif edit["kind"] == "band":
            factor = next(f for f in out["factors"] if f["fact"] == edit["fact"])
            band = next(b for b in factor["bands"] if b["band"] == edit["band"])
            band["pred"] = {edit["op"]: edit["value"]}
        else:
            raise GuidelineError(f"unknown edit {edit['kind']!r}")
    return out


if __name__ == "__main__":   # self-check: measure every scenario against the real book
    from .case import World
    from .engine import assess

    world = World.load()
    base = doc()

    def tiers(rules: RulesFile) -> dict[str, str]:
        out = {}
        for sub in world.submissions.values():
            a = assess(world.case(f"SUB-{sub['id']}"), rules)
            d = a.decision
            out[str(sub["id"])] = getattr(d, "kind", None) or ("routed" if hasattr(d, "to") else "open")
        return out

    before = tiers(active())
    for s in SCENARIOS:
        rules = apply_doc(apply_edits(base, s["edits"]))
        after = tiers(rules)
        moved = {k: (before[k], after[k]) for k in before if before[k] != after[k]}
        print(f"{s['id']:>20}: {len(moved)} tier changes {moved}")
        reset()
    assert active().thresholds["accept"] == 70, "reset must restore the file on disk"
    print("guideline.py self-check ok")
