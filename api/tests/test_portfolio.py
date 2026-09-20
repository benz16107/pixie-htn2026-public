"""ExposureIndex parity: ElasticIndex and InMemoryIndex must answer the same concentration
question. Skips (not fails) when the live Elastic project or the `pixie-exposure` index isn't
reachable, so `uv run pytest -q` still passes with the network off (AGENTS.md invariant 4).
"""

import pytest

from atlas_api.case import World
from atlas_api.portfolio import EXPOSURE_INDEX, ElasticIndex, InMemoryIndex, _elastic_client, open_index

# 10 open submissions with a resolvable site, picked deterministically (lowest ids).
CASE_IDS = ["1", "2", "4", "5", "6", "7", "8", "9", "10", "11"]


@pytest.fixture(scope="module")
def world() -> World:
    return World.load()


@pytest.fixture(scope="module")
def elastic_client():
    client = _elastic_client()
    if client is None or not client.indices.exists(index=EXPOSURE_INDEX):
        pytest.skip("Elastic unreachable or pixie-exposure not loaded (run scripts/load_elastic.py)")
    return client


def test_open_index_prefers_elastic_when_reachable(world, elastic_client):
    assert isinstance(open_index(world), ElasticIndex)


def test_elastic_and_memory_agree_on_concentration(world, elastic_client):
    mem = InMemoryIndex(world)
    es = ElasticIndex(elastic_client, world)
    compared = 0
    for case_id in CASE_IDS:
        case = world.case(f"SUB-{case_id}")
        if not case.sites or not case.sites[0].lat:
            continue
        insured = world.submissions[int(case_id)]["insured"]
        m, e = mem.impact(case, insured), es.impact(case, insured)
        assert (m is None) == (e is None)
        if m is None:
            continue
        assert m.cell == e.cell
        assert m.near_tiv == pytest.approx(e.near_tiv, rel=1e-6)
        assert m.cell_tiv == pytest.approx(e.cell_tiv, rel=1e-6)
        assert m.points == pytest.approx(e.points, rel=1e-6)
        assert set(m.policies) == set(e.policies)
        assert e.backend == "elastic"
        assert m.backend == "memory"
        compared += 1
    assert compared >= 8   # most of the 10 should have resolvable sites
