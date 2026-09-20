"""PrecedentIndex: search/significant_terms/percentile_rank parity between Elastic and the
in-memory fallback. Skips (not fails) when the live Elastic project or `pixie-precedent` isn't
reachable, so `uv run pytest -q` still passes with the network off (AGENTS.md invariant 4).
"""

import pytest

from atlas_api.case import World
from atlas_api.portfolio import _elastic_client
from atlas_api.precedent import PRECEDENT_INDEX, PrecedentIndex, build_precedent_docs, open_precedent_index


@pytest.fixture(scope="module")
def world() -> World:
    return World.load()


@pytest.fixture(scope="module")
def docs(world) -> list:
    return build_precedent_docs(world)


def test_build_precedent_docs_covers_bound_and_declined(world, docs):
    decisions = {d["decision"] for d in docs}
    assert decisions == {"bound", "declined"}
    assert sum(1 for d in docs if d["decision"] == "bound") == len(world.policies)
    declined_subs = [s for s in world.submissions.values() if s["status"] == "declined"]
    assert sum(1 for d in docs if d["decision"] == "declined") == len(declined_subs)
    # every doc has a numeric TIV and a written summary a semantic_text field can embed
    assert all(isinstance(d["tiv"], float) and d["summary"] for d in docs)


def test_memory_search_returns_real_hits_no_network(world, docs):
    index = PrecedentIndex(client=None, docs=docs)
    case = world.case("SUB-1")
    result = index.search(case, k=3)
    assert result.backend == "memory"
    assert 0 < len(result.hits) <= 3
    for h in result.hits:
        assert h.outcome    # real string built from the doc, never a model


def test_memory_declines_significant_terms_no_network(world, docs):
    index = PrecedentIndex(client=None, docs=docs)
    insight = index.declines_significant_terms()
    assert insight.backend == "memory"
    assert insight.n_book == len(docs)
    assert insight.n_declined > 0


def test_memory_percentile_rank_no_network(world, docs):
    index = PrecedentIndex(client=None, docs=docs)
    out = index.percentile_rank(tiv=10_000_000, premium=100_000)
    assert out["backend"] == "memory"
    assert 0 <= out["tivPercentile"] <= 100
    assert 0 <= out["premiumPercentile"] <= 100


@pytest.fixture(scope="module")
def elastic_client():
    client = _elastic_client()
    if client is None or not client.indices.exists(index=PRECEDENT_INDEX):
        pytest.skip("Elastic unreachable or pixie-precedent not loaded (run scripts/load_precedent.py)")
    return client


def test_open_precedent_index_prefers_elastic_when_reachable(world, elastic_client):
    index = open_precedent_index(world)
    assert index.client is not None


def test_elastic_search_returns_real_hits(world, docs, elastic_client):
    index = PrecedentIndex(elastic_client, docs)
    case = world.case("SUB-1")
    result = index.search(case, k=3)
    assert result.backend == "elastic"
    assert 0 < len(result.hits) <= 3


def test_elastic_significant_terms_and_percentile(world, docs, elastic_client):
    index = PrecedentIndex(elastic_client, docs)
    insight = index.declines_significant_terms()
    assert insight.backend == "elastic"
    assert insight.n_book == len(docs)
    out = index.percentile_rank(tiv=10_000_000, premium=100_000)
    assert out["backend"] == "elastic"
    assert 0 <= out["tivPercentile"] <= 100
