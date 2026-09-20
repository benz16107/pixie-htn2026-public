"""The live guideline (docs/GUIDELINE.md): read it, edit it, re-score the book, undo it.

The test that matters most is `test_every_reader_sees_the_edit`: the rules file is read by the
queue, the case view, the waterfall and what-if, and if one of them still read the file on disk the
screens would quietly disagree with each other.
"""

import copy

import pytest
from fastapi.testclient import TestClient

from atlas_api import guideline
from atlas_api.app import app


@pytest.fixture(scope="module")
def client(tmp_path_factory) -> TestClient:
    import os
    os.environ["ATLAS_DB"] = str(tmp_path_factory.mktemp("db") / "atlas.sqlite")
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _pristine(client):
    """Every test starts and ends on the guideline as it is on disk."""
    client.post("/guideline/reset")
    yield
    client.post("/guideline/reset")


def scenario(doc: dict, scenario_id: str) -> dict:
    s = next(s for s in doc["scenarios"] if s["id"] == scenario_id)
    return guideline.apply_edits(doc, s["edits"])


def band_of(doc: dict, fact: str, band: str) -> dict:
    factor = next(f for f in doc["factors"] if f["fact"] == fact)
    return next(b for b in factor["bands"] if b["band"] == band)


# ---------- reading it -------------------------------------------------------------------------

def test_guideline_reads_as_a_document(client):
    doc = client.get("/guideline").json()
    assert doc["id"] == "property_2025" and doc["edited"] is False and len(doc["hash"]) == 12
    assert doc["thresholds"] == {"decline": 45, "accept": 70}
    assert doc["hardFailCap"] == 30
    assert doc["points"] == {"target": 2, "acceptable": 1, "not_acceptable": 0}
    facts = {f["fact"] for f in doc["factors"]}
    assert facts == {"line", "business_type", "primary_admin", "tiv", "premium", "year_built",
                     "construction_share", "loss_5yr"}
    state = next(f for f in doc["factors"] if f["fact"] == "primary_admin")
    assert state["hardFail"] is True and state["label"] == "Primary state"
    assert next(f for f in doc["factors"] if f["fact"] == "line")["routes"] is True
    assert band_of(doc, "premium", "target")["text"] == "target: $75,000 to $100,000"


# ---------- validation: each rejection names its problem, and applies nothing ---------------------

def _broken(doc: dict, mutate) -> dict:
    out = copy.deepcopy(doc)
    mutate(out)
    return out


def _set_thresholds(d): d["thresholds"] = {"decline": 80, "accept": 70}
def _invert_band(d): band_of(d, "premium", "target")["pred"] = {"between": [100000, 75000]}
def _empty_band(d): band_of(d, "premium", "target")["pred"] = {"between": [75000, 75000]}
def _empty_list(d): band_of(d, "primary_admin", "acceptable")["pred"] = {"in": []}
def _no_catch_all(d):
    factor = next(f for f in d["factors"] if f["fact"] == "premium")
    factor["bands"] = [b for b in factor["bands"] if b["band"] != "not_acceptable"]
def _bad_points(d): d["points"] = {"target": 1, "acceptable": 2, "not_acceptable": 0}
def _high_cap(d): d["hardFailCap"] = 80
def _unknown_fact(d): d["factors"][0]["fact"] = "vibes"


@pytest.mark.parametrize("mutate, says", [
    (_set_thresholds, "below the accept threshold"),
    (_invert_band, "inverted"),
    (_empty_band, "empty"),
    (_empty_list, "empty"),
    (_no_catch_all, "catch-all"),
    (_bad_points, "target"),
    (_high_cap, "above the accept threshold"),
    (_unknown_fact, "unknown fact"),
])
def test_validation_rejects_and_says_why(client, mutate, says):
    doc = client.get("/guideline").json()
    resp = client.put("/guideline", json=_broken(doc, mutate))
    assert resp.status_code == 422, resp.text
    assert says in resp.json()["detail"]
    assert client.get("/guideline").json()["edited"] is False      # nothing was applied


def test_a_bad_edit_never_applies_the_good_half_of_itself(client):
    """Atomicity: a document that moves a threshold *and* inverts a band changes neither."""
    doc = client.get("/guideline").json()
    doc["thresholds"] = {"decline": 40, "accept": 65}
    _invert_band(doc)
    assert client.put("/guideline", json=doc).status_code == 422
    after = client.get("/guideline").json()
    assert after["thresholds"] == {"decline": 45, "accept": 70}
    assert after["edited"] is False
    assert client.get("/queue?view=open").json()[0]["score"] is not None


# ---------- applying it: the diff ----------------------------------------------------------------

def test_opening_washington_moves_143_into_the_queue(client):
    before = {r["caseId"]: r for r in client.get("/queue?view=all").json()}
    assert before["143"]["decision"]["kind"] == "decline"

    doc = client.get("/guideline").json()
    out = client.put("/guideline", json=scenario(doc, "open-washington"))
    assert out.status_code == 200, out.text
    diff = out.json()["diff"]

    moved = next(c for c in diff["cases"] if c["caseId"] == "143")
    assert moved["tierBefore"] == "decline" and moved["tierAfter"] == "open"
    assert [f["fact"] for f in moved["factors"]] == ["primary_admin"]
    assert moved["factors"][0]["from"] == ["not_acceptable"] and moved["factors"][0]["to"] == ["acceptable"]
    assert diff["counts"]["decline->open"] >= 1
    assert diff["valueIntoQueue"] == pytest.approx(before["143"]["valueAtStake"])
    assert diff["change"] == ["primary_admin acceptable: WA added"]
    assert any(m["caseId"] == "143" and m["delta"] > 0 for m in diff["rankMoves"])

    after = {r["caseId"]: r for r in client.get("/queue?view=all").json()}
    assert after["143"]["decision"]["kind"] == "open"
    assert out.json()["guideline"]["edited"] is True
    assert out.json()["guideline"]["hash"] != doc["hash"]


def test_every_scenario_still_does_what_its_label_says(client):
    """The scenario labels quote measured effects. If the data or the engine moves, this fails."""
    expected = {"open-washington": 1, "open-texas": 0, "loss-tolerance": 1,
                "premium-floor-75k": 1, "soften-hard-fail": 27}
    doc = client.get("/guideline").json()
    for s in doc["scenarios"]:
        diff = client.put("/guideline", json=scenario(doc, s["id"])).json()["diff"]
        assert diff["tierChanges"] == expected[s["id"]], (s["id"], diff["counts"])
        client.post("/guideline/reset")


def test_the_change_lands_in_the_case_ledger(client):
    client.put("/guideline", json=scenario(client.get("/guideline").json(), "open-washington"))
    events = client.get("/cases/143/events").json()
    e = next(e for e in events if e["kind"] == "guideline")
    assert e["actor"] == "human"
    assert e["body"]["decisionBefore" if "decisionBefore" in e["body"] else "decision_before"] == "decline"
    assert e["body"]["change"] == ["primary_admin acceptable: WA added"]
    assert e["body"]["hashBefore" if "hashBefore" in e["body"] else "hash_before"] != \
        e["body"]["hashAfter" if "hashAfter" in e["body"] else "hash_after"]


# ---------- the bug this feature is most likely to have -------------------------------------------

def test_every_reader_sees_the_edit(client):
    """The queue, the case view, the waterfall and what-if all score from one guideline."""
    client.put("/guideline", json=scenario(client.get("/guideline").json(), "open-washington"))

    row = next(r for r in client.get("/queue?view=all").json() if r["caseId"] == "143")
    view = client.get("/cases/143").json()
    explain = client.get("/cases/143/explain").json()
    whatif = client.post("/cases/143/whatif", json={"overrides": {}}).json()

    assert row["score"] == view["score"] == {"lo": explain["score"]["lo"], "hi": explain["score"]["hi"]}
    assert whatif["before"]["score"] == view["score"]        # what-if's baseline is the new guideline
    assert row["decision"]["kind"] == view["decision"]["kind"] == "open"

    step = next(s for s in explain["steps"] if s["key"].endswith("primary_admin"))
    assert step["band"] == "acceptable"                       # the waterfall cites the NEW band
    assert "WA" in step["rule"]
    # 143's state no longer hard-fails. The cap step survives on its estimated business type, but an
    # estimate can only pull the pessimistic end down, so the optimistic end is free of 30 now.
    caps = [s for s in explain["steps"] if s["kind"] == "cap"]
    assert caps[-1]["runningHi"] > 30 and view["score"]["hi"] > 30


def test_the_waterfall_cited_the_old_band_before_the_edit(client):
    """The other half of the test above: without the edit, 143 is capped on its state."""
    explain = client.get("/cases/143/explain").json()
    step = next(s for s in explain["steps"] if s["key"].endswith("primary_admin"))
    assert step["band"] == "not_acceptable"
    caps = [s for s in explain["steps"] if s["kind"] == "cap"]
    assert caps[-1]["runningLo"] == caps[-1]["runningHi"] == 30


# ---------- undo -----------------------------------------------------------------------------

def test_reset_restores_the_original_and_the_book(client):
    before = client.get("/queue?view=all").json()
    client.put("/guideline", json=scenario(client.get("/guideline").json(), "soften-hard-fail"))
    assert client.get("/guideline").json()["edited"] is True

    out = client.post("/guideline/reset").json()
    assert out["guideline"]["edited"] is False
    assert out["guideline"]["thresholds"] == {"decline": 45, "accept": 70}
    assert out["diff"]["tierChanges"] == 27                      # everything it moved, moved back
    assert client.get("/queue?view=all").json() == before
    assert client.post("/guideline/reset").json()["diff"]["changed"] == 0   # idempotent


def test_demo_reset_also_restores_the_guideline(client):
    before = client.get("/queue?view=all").json()
    client.put("/guideline", json=scenario(client.get("/guideline").json(), "open-washington"))
    client.post("/demo/reset")
    assert client.get("/guideline").json()["edited"] is False
    assert client.get("/queue?view=all").json() == before
    assert not [e for e in client.get("/cases/143/events").json() if e["kind"] == "guideline"]
