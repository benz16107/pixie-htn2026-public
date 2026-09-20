import time
from pathlib import Path

from atlas_api.case import Estimated
from atlas_api.case_store import CaseStore
from atlas_api.events import AnswerP, AskP, CaseFile, DeskEvent, EstimateP, PlanP


def test_append_is_idempotent_and_tail_is_a_cursor(tmp_path: Path):
    store = CaseStore.open(tmp_path / "t.sqlite")
    t0 = time.time()
    e = DeskEvent.make("138", "r1", "lead", PlanP(text="plan", depth="standard", floor="standard", deep_dive=True), t0=t0)
    assert store.append(e) is True
    assert store.append(DeskEvent.model_validate(e.model_dump())) is False   # same content, no-op
    ask = DeskEvent.make("138", "r1", "portfolio", AskP(text="?", to="hazard", question="which perils?"), t0=t0)
    store.append(ask)
    assert [x.seq for x in store.tail("138")] == [1, 2]
    assert [x.id for x in store.tail("138", after_seq=1)] == [ask.id]
    assert store.latest_run("138") == "r1"
    w = ask.wire()
    assert w["to"] == "hazard" and w["kind"] == "ask" and w["body"]["text"] == "?" and "kind" not in w["body"]


def test_fold_is_pure_and_tracks_asks_and_estimates():
    t0 = time.time()
    ask = DeskEvent.make("138", "r1", "portfolio", AskP(text="?", to="hazard", question="q"), t0=t0)
    ask.seq = 1
    est = DeskEvent.make("138", "r1", "intake", EstimateP(text="e", fact="premium", lo=1, hi=3, point=2, method="m"), t0=t0)
    est.seq = 2
    events = [ask, est]
    before = [e.model_dump() for e in events]
    f = CaseFile.fold(events)
    assert [e.model_dump() for e in events] == before
    assert isinstance(f.facts["premium"], Estimated) and [a.id for a in f.open_asks] == [ask.id]
    ans = DeskEvent.make("138", "r1", "hazard", AnswerP(text="a", to="portfolio", in_reply_to=ask.id), t0=t0)
    ans.seq = 3
    assert CaseFile.fold(events + [ans]).open_asks == ()
