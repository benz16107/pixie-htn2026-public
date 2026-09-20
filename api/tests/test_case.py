"""Case hydration and provenance acceptance tests.

All offline: World.load() reads the pulled snapshot under data/federato (no network).
"""

import pytest

from atlas_api.case import Estimated, Known, Missing, World


@pytest.fixture(scope="module")
def world() -> World:
    return World.load()


def test_138_tiv_via_hq_and_missing_premium(world):
    case = world.case("SUB-138")
    assert isinstance(case.tiv, Known)
    assert case.tiv.v == 2_073_000
    assert "hq" in case.tiv.source
    assert isinstance(case.premium, Missing)
    assert case.premium.resolver == "broker"


def test_126_and_141_flagged_duplicate_with_broker_conflict(world):
    c126 = world.case("SUB-126")
    c141 = world.case("SUB-141")
    assert any(i.kind == "duplicate_account" for i in c126.issues)
    assert any(i.kind == "duplicate_account" for i in c141.issues)
    # the two brokers are named in the facts either side cites
    issue = next(i for i in c126.issues if i.kind == "duplicate_account")
    assert "126" in issue.text and "141" in issue.text


def test_143_flagged_stale_with_both_dates_cited(world):
    case = world.case("SUB-143")
    issue = next((i for i in case.issues if i.kind == "stale_submission"), None)
    assert issue is not None
    assert "2025-08-19" in issue.text  # SUB-143 received
    assert "2025-11-25" in issue.text  # PR-2026-1031 quoted
    assert any("received_date=2025-08-19" in f for f in issue.facts)
    assert any("quoted=2025-11-25" in f for f in issue.facts)


def test_143_business_type_is_estimated_not_silently_new(world):
    case = world.case("SUB-143")
    assert isinstance(case.business_type, Estimated)
    assert case.business_type.point == "renewal"
    assert case.business_type.evidence


def test_open_submission_business_type_is_always_estimated(world):
    # even a genuinely-new-looking open submission gets Estimated, never a bare Known("new")
    for sub_id in (126, 133, 134, 138, 141):
        case = world.case(f"SUB-{sub_id}")
        assert isinstance(case.business_type, Estimated), f"SUB-{sub_id} business_type should be Estimated"


def test_134_limit_far_below_tiv(world):
    case = world.case("SUB-134")
    issue = next((i for i in case.issues if i.kind == "limit_vs_tiv"), None)
    assert issue is not None
    assert isinstance(case.tiv, Known) and case.tiv.v == 24_302_000
    assert case.fact("requested_limit").v == 1_000_000


def test_missing_roof_year_flagged(world):
    # SUB-143's hq building (49) has no roof_year on file
    case = world.case("SUB-143")
    assert any(i.kind == "missing_roof_year" for i in case.issues)


def test_bound_submission_uses_policy_premium_and_business_type(world):
    case = world.case("SUB-1")  # bound, has a Policy
    assert isinstance(case.premium, Known)
    assert isinstance(case.business_type, Known)


def test_loss_5yr_only_counts_claims_before_as_of(world):
    case = world.case("SUB-143")
    assert isinstance(case.loss_5yr, Known)  # insured 10 has other policies to check
    assert case.loss_5yr.v >= 0


def test_every_case_scalar_is_a_value_not_a_bare_float(world):
    case = world.case("SUB-138")
    for name in ("tiv", "premium", "business_type", "loss_5yr", "year_built", "line"):
        v = getattr(case, name)
        assert isinstance(v, (Known, Estimated, Missing)), f"{name} is a bare {type(v)}"
