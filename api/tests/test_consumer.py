"""Consumer insurance HTTP and deterministic quote acceptance tests."""

import os

import pytest
from fastapi.testclient import TestClient

from atlas_api.app import app
from atlas_api.consumer import compare_vehicles, estimate_auto_quote


@pytest.fixture(scope="module")
def client(tmp_path_factory) -> TestClient:
    os.environ["ATLAS_DB"] = str(tmp_path_factory.mktemp("consumer-db") / "atlas.sqlite")
    with TestClient(app) as test_client:
        yield test_client


def test_auto_quote_is_deterministic_and_receipt_reconciles_in_cents() -> None:
    inputs = {
        "vehicle_id": "corolla-le-2023",
        "annual_km_band": "under_10000",
        "parking": "garage",
        "deductible": 2000,
        "claims_5yr": 1,
    }
    first = estimate_auto_quote(**inputs)
    second = estimate_auto_quote(**inputs)
    cents = round(first["receipt"]["base"] * 100)
    cents += sum(round(line["dollars"] * 100) for line in first["receipt"]["lines"])

    assert first == second
    assert cents == round(first["annual"] * 100)
    assert first["quoteId"].startswith("AQ-")
    assert first["demoOnly"] is True and "Not an insurer quote" in first["label"]
    assert all(line["source"] and line["provenance"] == "bundled_demo_table" for line in first["receipt"]["lines"])


def test_vehicle_comparison_uses_one_scenario_and_sorts_by_estimate() -> None:
    result = compare_vehicles(vehicle_ids=["ioniq5-preferred-2024", "corolla-le-2023"])
    assert [row["vehicle"]["id"] for row in result["comparison"]] == ["corolla-le-2023", "ioniq5-preferred-2024"]
    assert result["sameScenario"]["deductible"] == 1000
    assert all(row["vehicle"]["provenance"] for row in result["comparison"])


def test_http_exposes_honest_home_scope_and_auto_contract(client: TestClient) -> None:
    capabilities = client.get("/consumer/capabilities").json()
    assert capabilities["products"]["home"]["available"] == ["tenant"]
    assert capabilities["products"]["home"]["homeownerAvailable"] is False
    assert capabilities["privacy"]["fullProfileTool"] is False
    comparison = client.post(
        "/consumer/vehicles/compare",
        json={"vehicleIds": ["ioniq5-preferred-2024", "corolla-le-2023"]},
    )
    assert comparison.status_code == 200
    assert comparison.json()["comparison"][0]["vehicle"]["id"] == "corolla-le-2023"

    home = client.post(
        "/quote/home",
        json={
            "homeProduct": "tenant",
            "address": "180 Queen St W",
            "answers": {"contentsValue": 30000, "unitLevel": "upper", "claims5yr": 0, "deductible": 1000},
        },
    )
    assert home.status_code == 200
    assert home.json()["supportedProduct"] == "tenant"
    assert "No homeowner tariff" in home.json()["scopeNote"]
    assert client.post(
        "/quote/home",
        json={"homeProduct": "homeowner", "address": "180 Queen St W", "answers": {"contentsValue": 30000, "unitLevel": "upper"}},
    ).status_code == 422

    auto = client.post(
        "/quote/auto",
        json={"vehicleId": "cx5-gs-2022", "annualKmBand": "10000_20000", "parking": "driveway", "deductible": 1000, "claims5yr": 2},
    )
    assert auto.status_code == 200
    body = auto.json()
    assert body["decision"]["kind"] == "advisor_review"
    assert body["vehicle"]["listingPrice"] == 30900
    assert body["receipt"]["baseSource"]


def test_combined_scenario_only_adds_computed_quote_totals(client: TestClient) -> None:
    response = client.post(
        "/quote/scenario",
        json={
            "tenant": {
                "address": "180 Queen St W",
                "answers": {"contentsValue": 30000, "unitLevel": "upper", "claims5yr": 0, "deductible": 1000},
            },
            "auto": {"vehicleId": "corolla-le-2023"},
        },
    )
    assert response.status_code == 200
    scenario = response.json()
    assert len(scenario["quotes"]) == 2
    assert round(scenario["combinedAnnual"] * 100) == sum(round(quote["annual"] * 100) for quote in scenario["quotes"])
    assert "independent illustrative estimates" in scenario["note"]


def test_policy_application_and_recovery_interfaces_are_privacy_limited(client: TestClient) -> None:
    policy = client.get("/policies/tenant-demo/summary")
    assert policy.status_code == 200
    assert policy.json()["privacy"]["fullProfileAvailable"] is False
    assert not ({"name", "address", "email", "phone"} & policy.json().keys())

    denied = client.post(
        "/applications/prepare",
        json={"quoteIds": ["AQ-12345678"], "contactPreference": "in_app", "consentToPrepare": False, "confirmDemoOnly": True},
    )
    assert denied.status_code == 422
    draft = client.post(
        "/applications/prepare",
        json={"quoteIds": ["AQ-12345678"], "contactPreference": "in_app", "consentToPrepare": True, "confirmDemoOnly": True},
    ).json()
    assert draft["status"] == "draft_prepared" and draft["submitted"] is False
    assert draft["privacy"]["fullProfileIncluded"] is False

    handoff = client.post(
        "/recovery/handoffs",
        json={
            "policyId": "auto-demo",
            "incidentType": "collision",
            "contactPreference": "phone_on_file",
            "consentToContact": True,
            "confirmDemoOnly": True,
        },
    )
    assert handoff.status_code == 200
    record = handoff.json()
    assert record["sent"] is False and record["privacy"]["contactValueIncluded"] is False
    assert client.get(f"/recovery/handoffs/{record['recoveryId']}").json() == record
