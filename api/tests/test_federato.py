"""Federato schema and query acceptance tests.

A few tests below hit the live Federato API (bad-operator error shape, a lint-fixed live query).
They need FEDERATO_CLIENT_ID/SECRET in .env, which the hackathon worktree has. Everything else
runs offline against the pulled snapshot and a committed schema fixture (AGENTS.md: cache
external lookups, demo runs with the network off).
"""

import json
from pathlib import Path

import pytest

from atlas_api.federato import (
    DEFAULT_SNAPSHOT_DIR,
    FederatoClient,
    FederatoError,
    FederatoErrorCode,
    QueryBuilder,
    SchemaGraph,
    Snapshot,
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def graph() -> SchemaGraph:
    raw = json.loads((FIXTURES / "schema.json").read_text())
    return SchemaGraph.from_schema(raw)


# ---------- T1: error parsing, snapshot -----------------------------------------------------------

def test_error_parse_validation():
    # the exact text a live "$grt" query returns (captured 2026-09-19)
    err = FederatoError.parse(
        'Workflow step error: [VALIDATION_ERROR] Unknown operator "$grt" {"operator":"$grt","path":"premium"}'
    )
    assert err.code is FederatoErrorCode.VALIDATION
    assert err.details == {"operator": "$grt", "path": "premium"}
    assert "Unknown operator" in err.message


def test_error_parse_unknown_code_falls_back():
    err = FederatoError.parse("[WEIRD_CODE] something broke")
    assert err.code is FederatoErrorCode.UNKNOWN


def test_error_parse_no_brackets_is_unknown():
    err = FederatoError.parse("plain 500 with no bracket prefix")
    assert err.code is FederatoErrorCode.UNKNOWN
    assert err.message == "plain 500 with no bracket prefix"


def test_bad_operator_raises_federato_error_live():
    client = FederatoClient.from_env()
    with pytest.raises(FederatoError) as exc:
        client.query({"resource": "Policy", "where": {"premium": {"$grt": 100}}}, use_cache=False)
    assert exc.value.code is FederatoErrorCode.VALIDATION


def test_snapshot_loads_158_submissions_and_938_exposure_units():
    snap = Snapshot.load(DEFAULT_SNAPSHOT_DIR)
    assert len(snap.all("Submission")) == 158
    assert len(snap.all("ExposureUnit")) == 938


def test_repeated_query_makes_zero_network_calls(tmp_path):
    client = FederatoClient(
        client_id=__import__("os").environ["FEDERATO_CLIENT_ID"],
        client_secret=__import__("os").environ["FEDERATO_CLIENT_SECRET"],
        cache_dir=tmp_path / "cache",
        token_path=tmp_path / ".token",
    )
    payload = {"resource": "Broker", "pagination": {"limit": 1}}
    first = client.query(payload)
    calls_after_first = client.network_calls
    assert calls_after_first >= 1
    second = client.query(payload)
    assert client.network_calls == calls_after_first  # cache hit, no new network call
    assert second.rows == first.rows


# ---------- T2: schema graph, hydration paths, lint ------------------------------------------------

def test_paths_returns_both_tiv_routes(graph):
    found = graph.paths("Submission", "Building.tiv")
    assert any("hq" in p.describe() for p in found), "missing the open (Insured.hq) route"
    assert any("exposure_units" in p.describe() for p in found), "missing the bound (exposure_units) route"
    # shortest first
    assert found == sorted(found, key=lambda p: len(p.hops))


def test_lint_flags_array_dot_path_with_elemmatch_fix(graph):
    qb = QueryBuilder(graph)
    issues = qb.lint({"resource": "Policy", "where": {"exposure_units.location.state": "CA"}})
    assert issues[0].kind == "array_dot_path"
    assert issues[0].at == "exposure_units.location.state"
    assert "$elemMatch" in issues[0].fix


def test_lint_clears_once_the_array_hop_is_unwound(graph):
    qb = QueryBuilder(graph)
    issues = qb.lint({
        "resource": "Policy",
        "unwind": ["exposure_units"],
        "filter": {"exposure_units.location.state": "CA"},
    })
    assert not any(i.kind == "array_dot_path" for i in issues)


def test_lint_is_clean_for_bare_reference_id_comparison(graph):
    # comparing a reference field to a raw id needs no expand (docs' own worked example does this)
    qb = QueryBuilder(graph)
    assert qb.lint({"resource": "Policy", "where": {"producer.broker": 2}}) == []


def test_lint_flags_reference_field_without_expand(graph):
    qb = QueryBuilder(graph)
    issues = qb.lint({"resource": "Policy", "where": {"producer.broker.name": "Acme"}})
    assert any(i.kind == "unexpanded_reference" for i in issues)


def test_fetch_builds_a_lint_clean_payload_that_runs_live(graph):
    # bound TIV route rooted at Policy (forward hops only; the Submission-rooted route starts with
    # a reverse hop, which fetch() intentionally refuses to build a payload for)
    paths = graph.paths("Policy", "Building.tiv")
    path = paths[0]
    qb = QueryBuilder(graph)
    payload = qb.fetch(path, where={"id": 1001})
    assert qb.lint(payload) == []

    client = FederatoClient.from_env()
    result = client.query(payload, use_cache=False)
    assert result.total >= 1
    assert result.rows
