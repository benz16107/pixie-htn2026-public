"""Driving-context privacy, provenance, and HTTP tests."""

import json
import os

import pytest
from fastapi.testclient import TestClient

from atlas_api.app import app
from atlas_api.driving import assess_drive_context


@pytest.fixture(scope="module")
def client(tmp_path_factory) -> TestClient:
    os.environ["ATLAS_DB"] = str(tmp_path_factory.mktemp("driving-db") / "atlas.sqlite")
    with TestClient(app) as test_client:
        yield test_client


def test_drive_context_is_deterministic_coaching_only_and_reconciles() -> None:
    inputs = {
        "points": [(43.65, -79.39), (43.66, -79.38)],
        "distance_km": 10,
        "speeding_events": 2,
        "hard_brake_events": 1,
    }
    first = assess_drive_context(**inputs)
    second = assess_drive_context(**inputs)

    assert first == second
    assert first["behaviorScore"] == 68
    assert first["routeContextScore"] == 70
    assert first["score"] == 69
    assert first["behaviorScore"] == 100 + sum(factor["effectPoints"] for factor in first["factors"])
    assert first["score"] == int(
        first["composite"]["behaviorContribution"] + first["composite"]["routeContextContribution"] + 0.5
    )
    assert first["coachingOnly"] is True
    assert first["affectsQuote"] is False and first["affectsPremium"] is False
    assert first["routeContext"]["labels"] == [
        "School approach",
        "Dense intersection and building corridor",
    ]
    assert first["routeContext"]["types"] == [
        "school_approach",
        "dense_intersection_building_corridor",
    ]
    assert all(factor["source"] and factor["provenance"] for factor in first["factors"])
    assert all(factor["source"] and factor["provenance"] for factor in first["routeFactors"])


def test_zero_event_school_route_preserves_perfect_behavior_score() -> None:
    result = assess_drive_context(
        points=[(43.65, -79.39), (43.651, -79.389)],
        distance_km=2,
        speeding_events=0,
        hard_brake_events=0,
    )

    assert result["behaviorScore"] == 100
    assert result["routeContextScore"] == 72
    assert result["score"] == 93
    assert result["routeContext"]["types"] == ["school_approach"]
    assert "does not indicate whether the driver behaved well or poorly" in result["routeContext"]["meaning"]
    assert result["affectsQuote"] is False and result["affectsPremium"] is False


def test_drive_context_returns_no_coordinates_and_stores_nothing() -> None:
    result = assess_drive_context(
        points=[(43.65, -79.39), (43.7, -79.4)],
        distance_km=8,
        speeding_events=0,
        hard_brake_events=0,
    )
    payload = json.dumps(result)
    assert "43.65" not in payload and "-79.39" not in payload
    assert result["privacy"]["stored"] is False
    assert result["privacy"]["identityInputsUsed"] is False
    assert result["privacy"]["rawCoordinateRetention"] == "none"
    assert result["routeContext"]["rawCoordinatesReturned"] is False


def test_drive_context_rejects_precise_route_points() -> None:
    with pytest.raises(ValueError, match="3 decimal"):
        assess_drive_context(
            points=[(43.65031, -79.39012), (43.65111, -79.38911)],
            distance_km=3,
            speeding_events=0,
            hard_brake_events=0,
        )


def test_http_driving_context_contract(client: TestClient) -> None:
    response = client.post(
        "/driving/context",
        json={
            "points": [{"lat": 43.65, "lng": -79.39}, {"lat": 43.7, "lng": -79.4}],
            "distanceKm": 8,
            "speedingEvents": 1,
            "hardBrakeEvents": 0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["routeContext"]["labels"] == ["School approach", "Lower-complexity corridor"]
    assert body["routeContext"]["types"] == ["school_approach", "lower_complexity_corridor"]
    assert body["behaviorScore"] == 85
    assert body["routeContextScore"] == 81
    assert body["score"] == 84
    assert all(factor["provenance"] for factor in body["routeFactors"])
    assert body["privacy"]["stored"] is False
    assert "does not change a quote or premium" in body["label"]

    precise = client.post(
        "/driving/context",
        json={
            "points": [{"lat": 43.65031, "lng": -79.39}, {"lat": 43.7, "lng": -79.4}],
            "distanceKm": 8,
        },
    )
    assert precise.status_code == 422
    assert "3 decimal" in precise.json()["detail"]
